import {
  FORCE_LABEL,
  FRONT_DESK,
  MEMBER_OFFERS,
  NOTICE_MINUTES,
  OVERTIME_MINUTES,
  OVERTIME_PRICE,
  canonicalService,
  memberCredit,
  services,
  technicianById,
  technicians,
  type Force,
  type Minutes,
  type Technician,
} from "./parlor.js";
import {
  addDays,
  appointmentId,
  endsAt,
  formatClock,
  guestBusy,
  leadMinutes,
  occupiedMinutes,
  overlaps,
  parseClock,
  pickRoom,
  roomFree,
  shanghaiNowMinutes,
  shanghaiToday,
  slotFits,
  technicianBusy,
  type Appointment,
  type ParlorState,
  type WaitlistEntry,
} from "./store.js";

export type TechnicianOption = { id: string; name: string; forceLabel: string };

export type PlaceInput = {
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: Minutes;
  technicianId: string;
  service: string;
  force: Force;
  notes: string;
};

export type PlaceResult =
  | { ok: true; alreadyBooked: boolean; clearedWaitlist: number; appointment: Appointment }
  | { ok: false; error: string; code: string; alternatives?: TechnicianOption[]; existing?: Appointment };

export function placeBooking(state: ParlorState, input: PlaceInput, now: Date): PlaceResult {
  const guestName = input.guestName.trim();
  if (guestName.length === 0) return fail("需要客人姓名。", "need_name");
  const today = shanghaiToday(now);
  if (input.date < today) return fail("不能预约已经过去的日期。", "past_date");
  if (input.date > addDays(today, 90)) return fail("最多预约 90 天以内。", "too_far");
  const start = parseClock(input.time);
  if (start === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  if (input.date === today && start < shanghaiNowMinutes(now)) return fail("这个开始时间已经过了。", "past_time");
  if (!slotFits(start, input.durationMinutes)) {
    return fail("营业时间是 10:00 到 22:00，项目必须在 22:00 前结束。", "outside_hours");
  }
  const technician = technicianById(input.technicianId);
  if (technician === undefined) return fail("没有这位技师，请改用 search_technicians 返回的 id。", "unknown_technician");
  const service = canonicalService(input.service);
  const mismatch = serviceMismatch(technician, service);
  if (mismatch !== undefined) return fail(mismatch, "service_mismatch");

  const id = appointmentId(input.phone, input.date, input.time);
  const existing = state.appointments.find((item) => item.id === id && item.status !== "cancelled");
  if (existing !== undefined && existing.technicianId === technician.id) {
    return { ok: true, alreadyBooked: true, clearedWaitlist: clearWaitlist(state, input.phone, technician.id, input.date, start, input.durationMinutes), appointment: existing };
  }
  const guestHit = guestBusy(state, input.phone, input.date, start, input.durationMinutes);
  if (guestHit !== undefined) return { ok: false, error: "这位客人在该时段已有预约。", code: "guest_busy", existing: guestHit };
  if (technicianBusy(state, technician.id, input.date, start, input.durationMinutes)) {
    return { ok: false, error: "该技师在这个时段已有预约。", code: "technician_busy", alternatives: alternativesFor(state, technician.id, input.date, start, input.durationMinutes, input.force) };
  }
  const room = pickRoom(state, input.date, start, input.durationMinutes);
  if (room === undefined) return fail("这个时段单人房已经排满。", "room_full");

  state.appointments = state.appointments.filter((item) => item.id !== id);
  const appointment: Appointment = {
    id,
    guestName,
    phone: input.phone,
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes,
    overtimeMinutes: 0,
    technicianId: technician.id,
    technicianName: technician.name,
    service,
    force: input.force,
    notes: input.notes.trim(),
    room,
    status: "booked",
    rescheduled: false,
    createdAt: now.toISOString(),
  };
  state.appointments.push(appointment);
  const clearedWaitlist = clearWaitlist(state, input.phone, technician.id, input.date, start, input.durationMinutes);
  return { ok: true, alreadyBooked: false, clearedWaitlist, appointment };
}

export type CancelResult =
  | { ok: true; alreadyCancelled: boolean; waitlistCount: number; appointment: Appointment }
  | { ok: false; error: string; code: string };

export function cancelAppointment(state: ParlorState, phone: string, appointmentIdValue: string, now: Date): CancelResult {
  const item = state.appointments.find((entry) => entry.id === appointmentIdValue && entry.phone === phone);
  if (item === undefined) return fail("没有找到这条预约。", "not_found");
  const waitlistCount = waitlistHits(state, item).length;
  if (item.status === "cancelled") return { ok: true, alreadyCancelled: true, waitlistCount, appointment: item };
  const notice = noticeFailure(item, now, "取消");
  if (notice !== undefined) return notice;
  item.status = "cancelled";
  state.cancellations.push({
    appointmentId: item.id,
    phone: item.phone,
    guestName: item.guestName,
    date: item.date,
    time: item.time,
    createdAt: now.toISOString(),
  });
  return { ok: true, alreadyCancelled: false, waitlistCount: waitlistHits(state, item).length, appointment: item };
}

export type RescheduleInput = {
  phone: string;
  appointmentId: string;
  date: string;
  time: string;
  durationMinutes: Minutes;
  technicianId: string;
  service: string;
  notes?: string;
};

export type RescheduleResult =
  | { ok: true; unchanged: boolean; appointment: Appointment }
  | { ok: false; error: string; code: string; alternatives?: TechnicianOption[] };

export function rescheduleAppointment(state: ParlorState, input: RescheduleInput, now: Date): RescheduleResult {
  const item = state.appointments.find((entry) => entry.id === input.appointmentId && entry.phone === input.phone);
  if (item === undefined) return fail("没有找到这条预约。", "not_found");
  if (item.status === "cancelled") return fail("这条预约已经取消。", "cancelled");
  const today = shanghaiToday(now);
  if (input.date < today) return fail("不能改到已经过去的日期。", "past_date");
  if (input.date > addDays(today, 90)) return fail("最多预约 90 天以内。", "too_far");
  const start = parseClock(input.time);
  if (start === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  if (input.date === today && start < shanghaiNowMinutes(now)) return fail("这个开始时间已经过了。", "past_time");
  const technician = technicianById(input.technicianId);
  if (technician === undefined) return fail("没有这位技师，请改用 search_technicians 返回的 id。", "unknown_technician");
  const service = canonicalService(input.service);
  const mismatch = serviceMismatch(technician, service);
  if (mismatch !== undefined) return fail(mismatch, "service_mismatch");
  const occupied = input.durationMinutes + item.overtimeMinutes;
  if (!slotFits(start, input.durationMinutes)) {
    return fail("营业时间是 10:00 到 22:00，项目必须在 22:00 前结束。", "outside_hours");
  }
  if (item.overtimeMinutes > 0 && !slotFits(start, occupied)) {
    return fail("改期后原来的加钟会超过 22:00。", "overtime_conflict");
  }

  const sameSlot =
    item.date === input.date &&
    item.time === input.time &&
    item.durationMinutes === input.durationMinutes &&
    item.technicianId === technician.id &&
    item.service === service;
  if (sameSlot) return { ok: true, unchanged: true, appointment: item };
  const notice = noticeFailure(item, now, "改期");
  if (notice !== undefined) return notice;
  if (item.rescheduled) return fail(`这条预约已经免费改过一次。请打前台 ${FRONT_DESK}。`, "already_rescheduled");

  const guestHit = guestBusy(state, input.phone, input.date, start, occupied, item.id);
  if (guestHit !== undefined) return fail("这位客人在该时段已有另一条预约。", "guest_busy");
  if (technicianBusy(state, technician.id, input.date, start, occupied, item.id)) {
    return {
      ok: false,
      error: "该技师在这个时段已有预约。",
      code: "technician_busy",
      alternatives: alternativesFor(state, technician.id, input.date, start, occupied, technician.force),
    };
  }
  let room = item.room;
  if (!roomFree(state, input.date, start, occupied, room, item.id)) {
    const moved = pickRoom(state, input.date, start, occupied, item.id);
    if (moved === undefined) return fail("这个时段单人房已经排满。", "room_full");
    room = moved;
  }
  const nextId = appointmentId(input.phone, input.date, input.time);
  if (nextId !== item.id) {
    const clash = state.appointments.find((entry) => entry.id === nextId);
    if (clash !== undefined && clash.status !== "cancelled") return fail("该时段已有预约。", "slot_taken");
    if (clash !== undefined) state.appointments = state.appointments.filter((entry) => entry.id !== nextId);
    item.id = nextId;
  }
  item.date = input.date;
  item.time = input.time;
  item.durationMinutes = input.durationMinutes;
  item.technicianId = technician.id;
  item.technicianName = technician.name;
  item.service = service;
  item.force = technician.force;
  item.room = room;
  item.rescheduled = true;
  if (input.notes !== undefined) item.notes = input.notes.trim();
  return { ok: true, unchanged: false, appointment: item };
}

export type OvertimeResult =
  | { ok: true; alreadyAdded: boolean; priceYuan: number; room: string; movedRoom: boolean; endsAt: string; appointment: Appointment }
  | { ok: false; error: string; code: string };

export function addOvertime(state: ParlorState, phone: string, appointmentIdValue: string, now: Date): OvertimeResult {
  const item = state.appointments.find((entry) => entry.id === appointmentIdValue && entry.phone === phone);
  if (item === undefined) return fail("没有找到这条预约。", "not_found");
  if (item.status === "cancelled") return fail("这条预约已经取消。", "cancelled");
  const priceYuan = OVERTIME_PRICE[item.service];
  if (priceYuan === undefined) return fail("这个项目不能加钟。", "no_overtime");
  const start = parseClock(item.time);
  if (start === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  const lead = leadMinutes(item.date, item.time, now);
  if (lead === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  if (lead + occupiedMinutes(item) <= 0) return fail("这场已经结束，不能加钟。", "already_started");
  if (item.overtimeMinutes === OVERTIME_MINUTES) {
    return { ok: true, alreadyAdded: true, priceYuan, room: item.room, movedRoom: false, endsAt: endsAt(item.time, item.durationMinutes, item.overtimeMinutes), appointment: item };
  }
  const nextDuration = item.durationMinutes + OVERTIME_MINUTES;
  if (!slotFits(start, nextDuration)) return fail("加钟后会超过 22:00。", "past_close");
  if (technicianBusy(state, item.technicianId, item.date, start, nextDuration, item.id)) {
    return fail("加钟会和该技师的下一单重叠。", "technician_busy");
  }
  let room = item.room;
  let movedRoom = false;
  if (!roomFree(state, item.date, start, nextDuration, room, item.id)) {
    const moved = pickRoom(state, item.date, start, nextDuration, item.id);
    if (moved === undefined) return fail("加钟后没有空着的单人房。", "room_full");
    room = moved;
    movedRoom = true;
  }
  item.overtimeMinutes = OVERTIME_MINUTES;
  item.room = room;
  return { ok: true, alreadyAdded: false, priceYuan, room, movedRoom, endsAt: formatClock(start + nextDuration), appointment: item };
}

export type WaitlistResult =
  | { ok: true; alreadyWaiting: boolean; entry: WaitlistEntry }
  | { ok: false; error: string; code: string };

export function joinWaitlist(
  state: ParlorState,
  input: { guestName: string; phone: string; date: string; time: string; durationMinutes: Minutes; technicianId: string; service: string },
  now: Date,
): WaitlistResult {
  const guestName = input.guestName.trim();
  if (guestName.length === 0) return fail("需要客人姓名。", "need_name");
  const today = shanghaiToday(now);
  if (input.date < today) return fail("不能候补已经过去的日期。", "past_date");
  if (input.date > addDays(today, 90)) return fail("最多预约 90 天以内。", "too_far");
  const start = parseClock(input.time);
  if (start === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  if (input.date === today && start < shanghaiNowMinutes(now)) return fail("这个开始时间已经过了。", "past_time");
  if (!slotFits(start, input.durationMinutes)) return fail("营业时间是 10:00 到 22:00，项目必须在 22:00 前结束。", "outside_hours");
  const technician = technicianById(input.technicianId);
  if (technician === undefined) return fail("没有这位技师，请改用 search_technicians 返回的 id。", "unknown_technician");
  const service = canonicalService(input.service);
  const mismatch = serviceMismatch(technician, service);
  if (mismatch !== undefined) return fail(mismatch, "service_mismatch");
  if (guestBusy(state, input.phone, input.date, start, input.durationMinutes) !== undefined) {
    return fail("这位客人在该时段已有预约。", "guest_busy");
  }
  const technicianOpen = !technicianBusy(state, technician.id, input.date, start, input.durationMinutes);
  const roomOpen = pickRoom(state, input.date, start, input.durationMinutes) !== undefined;
  if (technicianOpen && roomOpen) return fail("该时段技师和房间都有空，可以直接预约。", "technician_free");

  const duplicate = state.waitlist.find(
    (entry) => entry.phone === input.phone && entry.date === input.date && entry.time === input.time && entry.technicianId === technician.id,
  );
  if (duplicate !== undefined) return { ok: true, alreadyWaiting: true, entry: duplicate };
  const entry: WaitlistEntry = {
    id: `wait_${input.phone}_${input.date}_${input.time.replace(":", "")}_${technician.id}`,
    guestName,
    phone: input.phone,
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes,
    technicianId: technician.id,
    technicianName: technician.name,
    service,
    createdAt: now.toISOString(),
  };
  state.waitlist.push(entry);
  return { ok: true, alreadyWaiting: false, entry };
}

export type QuoteResult =
  | { ok: true; service: string; durationMinutes: number; priceYuan: number; overtimePriceYuan: number; totalYuan: number }
  | { ok: false; error: string; code: string };

export function quoteVisit(serviceInput: string, durationMinutes: number, withOvertime: boolean): QuoteResult {
  const service = canonicalService(serviceInput);
  const item = services.find((entry) => entry.name === service);
  if (item === undefined) return fail("没有这个项目。", "unknown_service");
  const option = item.options.find((entry) => entry.minutes === durationMinutes);
  if (option === undefined) return fail(`${service}没有 ${durationMinutes} 分钟的价。`, "unknown_duration");
  const overtimePriceYuan = withOvertime ? OVERTIME_PRICE[service] : 0;
  if (withOvertime && overtimePriceYuan === undefined) return fail("这个项目不能加钟。", "no_overtime");
  const extra = overtimePriceYuan ?? 0;
  return { ok: true, service, durationMinutes, priceYuan: option.price, overtimePriceYuan: extra, totalYuan: option.price + extra };
}

export type MemberView =
  | { ok: true; member: false; phone: string; offers: Array<{ paidYuan: number; creditedYuan: number }> }
  | { ok: true; member: true; phone: string; guestName: string; balanceYuan: number; rechargeCount: number; offers: Array<{ paidYuan: number; creditedYuan: number }> };

export function lookupMember(state: ParlorState, phone: string): MemberView {
  const offers = MEMBER_OFFERS.map((item) => ({ paidYuan: item.paidYuan, creditedYuan: item.creditedYuan }));
  const member = state.members.find((item) => item.phone === phone);
  if (member === undefined) return { ok: true, member: false, phone, offers };
  return { ok: true, member: true, phone, guestName: member.guestName, balanceYuan: member.balanceYuan, rechargeCount: member.recharges.length, offers };
}

export type RechargeResult =
  | { ok: true; phone: string; guestName: string; paidYuan: number; creditedYuan: number; balanceYuan: number }
  | { ok: false; error: string; code: string };

export function rechargeMember(state: ParlorState, phone: string, paidYuan: number, guestName: string, now: Date): RechargeResult {
  const creditedYuan = memberCredit(paidYuan);
  if (creditedYuan === undefined) return fail("只能入账 500 或 1000 元。", "invalid_amount");
  const known = state.appointments.find((item) => item.phone === phone);
  const existing = state.members.find((item) => item.phone === phone);
  const name = guestName.trim() || existing?.guestName || known?.guestName || "";
  if (name.length === 0) return fail("入账需要客人姓名。", "need_name");
  const member = existing ?? { phone, guestName: name, balanceYuan: 0, recharges: [] };
  if (existing === undefined) state.members.push(member);
  member.guestName = name;
  member.balanceYuan += creditedYuan;
  member.recharges.push({ paidYuan, creditedYuan, createdAt: now.toISOString() });
  return { ok: true, phone, guestName: name, paidYuan, creditedYuan, balanceYuan: member.balanceYuan };
}

export type DayAppointment = {
  time: string;
  endsAt: string;
  guestName: string;
  technicianName: string;
  service: string;
  room: string;
  durationMinutes: number;
  overtimeMinutes: number;
};

export type DayBoard = {
  date: string;
  appointmentCount: number;
  busyRoomCount: number;
  freeRoomCount: number;
  waitlistCount: number;
  appointments?: DayAppointment[];
};

export function describeDay(state: ParlorState, date: string, includeGuests: boolean): DayBoard {
  const items = state.appointments
    .filter((item) => item.date === date && item.status !== "cancelled")
    .sort((a, b) => a.time.localeCompare(b.time) || a.room.localeCompare(b.room));
  const rooms = new Set(items.map((item) => item.room).filter((room) => room.length > 0));
  const board: DayBoard = {
    date,
    appointmentCount: items.length,
    busyRoomCount: rooms.size,
    freeRoomCount: Math.max(0, 8 - rooms.size),
    waitlistCount: state.waitlist.filter((item) => item.date === date).length,
  };
  if (!includeGuests) return board;
  board.appointments = items.map((item) => ({
    time: item.time,
    endsAt: endsAt(item.time, item.durationMinutes, item.overtimeMinutes),
    guestName: item.guestName,
    technicianName: item.technicianName,
    service: item.service,
    room: item.room,
    durationMinutes: item.durationMinutes,
    overtimeMinutes: item.overtimeMinutes,
  }));
  return board;
}

function waitlistHits(state: ParlorState, appointment: Appointment): WaitlistEntry[] {
  const start = parseClock(appointment.time);
  if (start === undefined) return [];
  const duration = occupiedMinutes(appointment);
  return state.waitlist.filter((item) => {
    if (item.date !== appointment.date || item.technicianId !== appointment.technicianId) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, item.durationMinutes);
  });
}

function clearWaitlist(state: ParlorState, phone: string, technicianId: string, date: string, start: number, duration: number): number {
  const before = state.waitlist.length;
  state.waitlist = state.waitlist.filter((item) => {
    if (item.phone !== phone || item.technicianId !== technicianId || item.date !== date) return true;
    const other = parseClock(item.time);
    if (other === undefined) return true;
    return !overlaps(start, duration, other, item.durationMinutes);
  });
  return before - state.waitlist.length;
}

function noticeFailure(item: Appointment, now: Date, action: string): { ok: false; error: string; code: string } | undefined {
  const lead = leadMinutes(item.date, item.time, now);
  if (lead === undefined) return fail("开始时间请用整点或半点，例如 15:00。", "bad_time");
  if (lead <= 0) return fail(`这场已经开始或结束，不能${action}。`, "already_started");
  if (lead < NOTICE_MINUTES) return fail(`需要至少提前 2 小时${action}。请打前台 ${FRONT_DESK}。`, "too_late");
  return undefined;
}

function serviceMismatch(technician: Technician, service: string): string | undefined {
  const known = services.some((item) => item.name === service);
  if (known && !technician.services.includes(service)) return `${technician.name}不做${service}。`;
  return undefined;
}

function alternativesFor(
  state: ParlorState,
  technicianId: string,
  date: string,
  start: number,
  duration: number,
  force: Force,
): TechnicianOption[] {
  return technicians
    .filter((item) => item.id !== technicianId && !technicianBusy(state, item.id, date, start, duration))
    .sort((a, b) => Number(b.force === force) - Number(a.force === force) || b.years - a.years)
    .slice(0, 3)
    .map((item) => ({ id: item.id, name: item.name, forceLabel: FORCE_LABEL[item.force] }));
}

function fail(error: string, code: string): { ok: false; error: string; code: string } {
  return { ok: false, error, code };
}
