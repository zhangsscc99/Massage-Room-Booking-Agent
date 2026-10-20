import assert from "node:assert/strict";
import type { HostKvApi, JsonValue } from "@cursor/bdk";
import {
  addOvertime,
  cancelAppointment,
  describeDay,
  joinWaitlist,
  lookupMember,
  placeBooking,
  quoteVisit,
  rechargeMember,
  rescheduleAppointment,
} from "../bot/lib/desk.ts";
import { planFollowUps } from "../bot/lib/followups.ts";
import type { Minutes, Force } from "../bot/lib/parlor.ts";
import {
  addDays,
  loadState,
  saveState,
  shanghaiNowMinutes,
  shanghaiToday,
  technicianBusy,
  type Appointment,
  type ParlorState,
} from "../bot/lib/store.ts";

const NOW = new Date("2026-10-20T02:00:00.000Z");
const TODAY = shanghaiToday(NOW);

function memoryKv(): HostKvApi {
  const data = new Map<string, JsonValue>();
  return {
    async get(key) {
      return data.get(key);
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
  };
}

async function seeded(): Promise<ParlorState> {
  return loadState(memoryKv(), NOW);
}

function book(
  state: ParlorState,
  input: {
    guestName: string;
    phone: string;
    date: string;
    time: string;
    durationMinutes?: Minutes;
    technicianId: string;
    service: string;
    force?: Force;
  },
): Appointment {
  const result = placeBooking(
    state,
    {
      guestName: input.guestName,
      phone: input.phone,
      date: input.date,
      time: input.time,
      durationMinutes: input.durationMinutes ?? 60,
      technicianId: input.technicianId,
      service: input.service,
      force: input.force ?? "strong",
      notes: "",
    },
    NOW,
  );
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error("unreachable");
  return result.appointment;
}

async function main(): Promise<void> {
  assert.equal(TODAY, "2026-10-20");
  assert.equal(shanghaiNowMinutes(NOW), 10 * 60);

  const quote = quoteVisit("中式推拿", 60, false);
  assert.equal(quote.ok && quote.totalYuan, 298);
  const withExtra = quoteVisit("中式推拿", 90, true);
  assert.equal(withExtra.ok && withExtra.priceYuan, 398);
  assert.equal(withExtra.ok && withExtra.overtimePriceYuan, 80);
  assert.equal(withExtra.ok && withExtra.totalYuan, 478);
  const shoulder = quoteVisit("肩颈专项", 45, true);
  assert.equal(shoulder.ok && shoulder.totalYuan, 228);
  assert.equal(quoteVisit("肩颈专项", 60, false).ok, false);
  assert.equal(quoteVisit("没有的项目", 60, false).ok, false);

  const fresh = await seeded();
  const member = lookupMember(fresh, "13800001111");
  assert.equal(member.member, true);
  if (member.member) assert.equal(member.balanceYuan, 1100);
  const guest = lookupMember(fresh, "18644445555");
  assert.equal(guest.member, false);

  const opened = rechargeMember(fresh, "13100002222", 500, "周周", NOW);
  assert.equal(opened.ok && opened.balanceYuan, 530);
  const stacked = rechargeMember(fresh, "13100002222", 1000, "周周", NOW);
  assert.equal(stacked.ok && stacked.balanceYuan, 1630);
  const rejected = rechargeMember(fresh, "13100002222", 200, "周周", NOW);
  assert.equal(rejected.ok, false);
  const stackedView = lookupMember(fresh, "13100002222");
  assert.equal(stackedView.member, true);
  if (stackedView.member) assert.equal(stackedView.balanceYuan, 1630);
  assert.equal(rechargeMember(fresh, "13100003333", 500, "", NOW).ok, false);

  const day = addDays(TODAY, 2);
  const preference = await seeded();
  book(preference, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  const sameForce = placeBooking(
    preference,
    { guestName: "吴吴", phone: "13600006666", date: day, time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿", force: "strong", notes: "" },
    NOW,
  );
  assert.equal(sameForce.ok, false);
  if (!sameForce.ok) assert.equal(sameForce.alternatives?.[0]?.name, "周师傅");

  const rooms = await seeded();
  const first = book(rooms, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  const second = book(rooms, { guestName: "周周", phone: "13600005555", date: day, time: "15:00", technicianId: "zhou", service: "足疗" });
  assert.equal(first.room, "1号房");
  assert.notEqual(second.room, first.room);
  const clash = placeBooking(
    rooms,
    { guestName: "吴吴", phone: "13600006666", date: day, time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿", force: "strong", notes: "" },
    NOW,
  );
  assert.equal(clash.ok, false);
  if (!clash.ok) assert.equal(clash.alternatives?.[0]?.name, "大鹏");
  const wrongService = placeBooking(
    rooms,
    { guestName: "吴吴", phone: "13600006666", date: day, time: "16:00", durationMinutes: 60, technicianId: "xiaorou", service: "中式推拿", force: "light", notes: "" },
    NOW,
  );
  assert.equal(wrongService.ok, false);
  if (!wrongService.ok) assert.equal(wrongService.code, "service_mismatch");

  const notice = await seeded();
  const soon = book(notice, { guestName: "陈晨", phone: "13600004444", date: TODAY, time: "11:00", technicianId: "liqiang", service: "中式推拿" });
  const tooLate = cancelAppointment(notice, soon.phone, soon.id, NOW);
  assert.equal(tooLate.ok, false);
  if (!tooLate.ok) assert.equal(tooLate.code, "too_late");
  assert.equal(notice.appointments.find((item) => item.id === soon.id)?.status, "booked");
  const onTime = book(notice, { guestName: "陈晨", phone: "13600004444", date: TODAY, time: "12:00", technicianId: "zhou", service: "足疗" });
  const cancelled = cancelAppointment(notice, onTime.phone, onTime.id, NOW);
  assert.equal(cancelled.ok, true);
  assert.equal(technicianBusy(notice, "zhou", TODAY, 12 * 60, 60), false);
  const again = book(notice, { guestName: "陈晨", phone: "13600004444", date: TODAY, time: "12:00", technicianId: "zhou", service: "足疗" });
  assert.equal(again.status, "booked");

  const moves = await seeded();
  const original = book(moves, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  const moved = rescheduleAppointment(
    moves,
    { phone: original.phone, appointmentId: original.id, date: addDays(TODAY, 3), time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿" },
    NOW,
  );
  assert.equal(moved.ok, true);
  if (moved.ok) assert.equal(moved.appointment.rescheduled, true);
  const secondMove = rescheduleAppointment(
    moves,
    { phone: original.phone, appointmentId: moved.ok ? moved.appointment.id : original.id, date: addDays(TODAY, 4), time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿" },
    NOW,
  );
  assert.equal(secondMove.ok, false);
  if (!secondMove.ok) assert.equal(secondMove.code, "already_rescheduled");
  assert.equal(moves.appointments.find((item) => item.phone === original.phone && item.status === "booked")?.date, addDays(TODAY, 3));

  const extra = await seeded();
  const visit = book(extra, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  book(extra, { guestName: "周周", phone: "13600005555", date: day, time: "16:00", technicianId: "liqiang", service: "中式推拿" });
  const blocked = addOvertime(extra, visit.phone, visit.id, NOW);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "technician_busy");
  const lateNight = book(extra, { guestName: "陈晨", phone: "13600004444", date: addDays(TODAY, 3), time: "21:00", technicianId: "liqiang", service: "中式推拿" });
  const pastClose = addOvertime(extra, lateNight.phone, lateNight.id, NOW);
  assert.equal(pastClose.ok, false);
  if (!pastClose.ok) assert.equal(pastClose.code, "past_close");

  const packed = await seeded();
  const anchor = book(packed, { guestName: "客人0", phone: "13600000000", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  book(packed, { guestName: "周周", phone: "13600005555", date: day, time: "16:00", technicianId: "zhou", service: "足疗" });
  const movedRoom = addOvertime(packed, anchor.phone, anchor.id, NOW);
  assert.equal(movedRoom.ok, true);
  if (movedRoom.ok) {
    assert.equal(movedRoom.movedRoom, true);
    assert.equal(movedRoom.room, "2号房");
    assert.equal(movedRoom.priceYuan, 80);
  }
  const full = await seeded();
  const staying = book(full, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  for (const room of ["1号房", "2号房", "3号房", "4号房", "5号房", "6号房", "7号房", "8号房"]) {
    full.appointments.push({
      id: `block_${room}`,
      guestName: "占房",
      phone: "13100009999",
      date: day,
      time: "16:00",
      durationMinutes: 60,
      overtimeMinutes: 0,
      technicianId: `block-${room}`,
      technicianName: "占房",
      service: "中式推拿",
      force: "medium",
      notes: "",
      room,
      status: "booked",
      rescheduled: false,
      createdAt: NOW.toISOString(),
    });
  }
  const noRoom = addOvertime(full, staying.phone, staying.id, NOW);
  assert.equal(noRoom.ok, false);
  if (!noRoom.ok) assert.equal(noRoom.code, "room_full");

  const queue = await seeded();
  const held = book(queue, { guestName: "陈晨", phone: "13600004444", date: day, time: "15:00", technicianId: "liqiang", service: "中式推拿" });
  const waiting = joinWaitlist(
    queue,
    { guestName: "周周", phone: "13600005555", date: day, time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿" },
    NOW,
  );
  assert.equal(waiting.ok, true);
  const open = joinWaitlist(
    queue,
    { guestName: "吴吴", phone: "13600006666", date: day, time: "18:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿" },
    NOW,
  );
  assert.equal(open.ok, false);
  if (!open.ok) assert.equal(open.code, "technician_free");
  const released = cancelAppointment(queue, held.phone, held.id, NOW);
  assert.equal(released.ok && released.waitlistCount, 1);
  const claimed = placeBooking(
    queue,
    { guestName: "周周", phone: "13600005555", date: day, time: "15:00", durationMinutes: 60, technicianId: "liqiang", service: "中式推拿", force: "strong", notes: "" },
    NOW,
  );
  assert.equal(claimed.ok && claimed.clearedWaitlist, 1);
  assert.equal(queue.waitlist.length, 0);

  const follow = await seeded();
  const todayPlan = planFollowUps(follow, TODAY, 14);
  const sun = todayPlan.guests.find((item) => item.phone === "15833334444");
  const zhao = todayPlan.guests.find((item) => item.phone === "13522223333");
  const zhang = todayPlan.guests.find((item) => item.phone === "13800001111");
  assert.equal(sun?.needsFollowUp, false);
  assert.equal(sun?.skipReason, "upcoming_visit");
  assert.equal(zhao?.skipReason, "recent_follow_up");
  assert.equal(zhang?.needsFollowUp, true);
  const future = follow.appointments.find((item) => item.phone === "15833334444" && item.date > TODAY);
  assert.ok(future);
  if (future !== undefined) {
    const dropped = cancelAppointment(follow, future.phone, future.id, NOW);
    assert.equal(dropped.ok, true);
  }
  const after = planFollowUps(follow, TODAY, 14).guests.find((item) => item.phone === "15833334444");
  assert.equal(after?.needsFollowUp, true);

  const board = describeDay(follow, addDays(TODAY, 5), true);
  assert.equal(JSON.stringify(board).includes("15833334444"), false);
  const quiet = describeDay(await seeded(), TODAY, false);
  assert.equal(quiet.appointmentCount, 0);
  assert.equal(quiet.freeRoomCount, 8);
  assert.equal("appointments" in quiet, false);

  const kv = memoryKv();
  await kv.put("parlor-state", {
    appointments: [
      {
        id: "apt_old",
        guestName: "测试",
        phone: "13100001111",
        date: day,
        time: "15:00",
        durationMinutes: 60,
        technicianId: "liqiang",
        technicianName: "力强",
        service: "中式推拿",
        force: "strong",
        notes: "",
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    followUps: [],
  } as JsonValue);
  const migrated = await loadState(kv, NOW);
  assert.equal(migrated.appointments[0]?.status, "booked");
  assert.equal(migrated.appointments[0]?.room, "1号房");
  assert.equal(migrated.members.some((item) => item.phone === "13800001111"), true);
  const reread = await loadState(kv, NOW);
  assert.equal(reread.members.length, migrated.members.length);

  const emptyMembers = memoryKv();
  await emptyMembers.put("parlor-state", {
    appointments: [
      {
        id: "apt_kept",
        guestName: "测试",
        phone: "13100001111",
        date: day,
        time: "15:00",
        durationMinutes: 60,
        technicianId: "liqiang",
        technicianName: "力强",
        service: "中式推拿",
        force: "strong",
        notes: "",
        room: "3号房",
        status: "booked",
        rescheduled: false,
        overtimeMinutes: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    followUps: [],
    consultations: [],
    cancellations: [],
    members: [],
    waitlist: [],
  } as JsonValue);
  const kept = await loadState(emptyMembers, NOW);
  assert.equal(kept.members.length, 0);
  assert.equal(kept.appointments[0]?.room, "3号房");
  await saveState(emptyMembers, kept);

  console.log("desk checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
