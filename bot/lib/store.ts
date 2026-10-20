import type { HostKvApi, JsonValue } from "@cursor/bdk";
import {
  CLOSE_MIN,
  FORCE_LABEL,
  OPEN_MIN,
  SINGLE_ROOMS,
  technicianById,
  type Force,
} from "./parlor.js";

export type AppointmentStatus = "booked" | "cancelled";

export type Appointment = {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  overtimeMinutes: number;
  technicianId: string;
  technicianName: string;
  service: string;
  force: Force;
  notes: string;
  room: string;
  status: AppointmentStatus;
  rescheduled: boolean;
  createdAt: string;
};

export type FollowUp = {
  phone: string;
  guestName: string;
  message: string;
  createdAt: string;
};

export type Consultation = {
  id: string;
  phone: string;
  guestName: string;
  question: string;
  createdAt: string;
};

export type Cancellation = {
  appointmentId: string;
  phone: string;
  guestName: string;
  date: string;
  time: string;
  createdAt: string;
};

export type MemberRecharge = {
  paidYuan: number;
  creditedYuan: number;
  createdAt: string;
};

export type Member = {
  phone: string;
  guestName: string;
  balanceYuan: number;
  recharges: MemberRecharge[];
};

export type WaitlistEntry = {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  technicianId: string;
  technicianName: string;
  service: string;
  createdAt: string;
};

export type ParlorState = {
  appointments: Appointment[];
  followUps: FollowUp[];
  consultations: Consultation[];
  cancellations: Cancellation[];
  members: Member[];
  waitlist: WaitlistEntry[];
};

const KEY = "parlor-state";

export function shanghaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shanghaiNowMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function daysBetween(later: string, earlier: string): number {
  const end = Date.parse(`${later}T00:00:00Z`);
  const start = Date.parse(`${earlier}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function parseClock(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return undefined;
  if (minute !== 0 && minute !== 30) return undefined;
  return hour * 60 + minute;
}

export function slotFits(start: number, duration: number): boolean {
  return start >= OPEN_MIN && start + duration <= CLOSE_MIN;
}

export function overlaps(startA: number, durationA: number, startB: number, durationB: number): boolean {
  return startA < startB + durationB && startB < startA + durationA;
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function occupiedMinutes(item: Pick<Appointment, "durationMinutes" | "overtimeMinutes">): number {
  return item.durationMinutes + item.overtimeMinutes;
}

export function leadMinutes(date: string, time: string, now: Date): number | undefined {
  const start = parseClock(time);
  if (start === undefined) return undefined;
  return daysBetween(date, shanghaiToday(now)) * 1440 + start - shanghaiNowMinutes(now);
}

export function endsAt(time: string, durationMinutes: number, overtimeMinutes: number): string {
  const start = parseClock(time);
  if (start === undefined) return "";
  return formatClock(start + durationMinutes + overtimeMinutes);
}

export function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits;
  return /^1\d{10}$/.test(local) ? local : undefined;
}

export function technicianBusy(
  state: ParlorState,
  technicianId: string,
  date: string,
  start: number,
  duration: number,
  excludeId?: string,
): boolean {
  return state.appointments.some((item) => {
    if (item.status === "cancelled" || item.technicianId !== technicianId || item.date !== date) return false;
    if (excludeId !== undefined && item.id === excludeId) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, occupiedMinutes(item));
  });
}

export function guestBusy(
  state: ParlorState,
  phone: string,
  date: string,
  start: number,
  duration: number,
  excludeId?: string,
): Appointment | undefined {
  return state.appointments.find((item) => {
    if (item.status === "cancelled" || item.phone !== phone || item.date !== date) return false;
    if (excludeId !== undefined && item.id === excludeId) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, occupiedMinutes(item));
  });
}

export function roomFree(
  state: ParlorState,
  date: string,
  start: number,
  duration: number,
  room: string,
  excludeId?: string,
): boolean {
  return !state.appointments.some((item) => {
    if (item.status === "cancelled" || item.room !== room || item.date !== date) return false;
    if (excludeId !== undefined && item.id === excludeId) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, occupiedMinutes(item));
  });
}

export function pickRoom(
  state: ParlorState,
  date: string,
  start: number,
  duration: number,
  excludeId?: string,
): string | undefined {
  return SINGLE_ROOMS.find((room) => roomFree(state, date, start, duration, room, excludeId));
}

export function assignOpenRooms(state: ParlorState): boolean {
  let changed = false;
  const ordered = [...state.appointments].sort((a, b) => `${a.date} ${a.time} ${a.id}`.localeCompare(`${b.date} ${b.time} ${b.id}`));
  for (const item of ordered) {
    if (item.status === "cancelled" || item.room.length > 0) continue;
    const start = parseClock(item.time);
    if (start === undefined) continue;
    item.room = pickRoom(state, item.date, start, occupiedMinutes(item), item.id) ?? "前台安排";
    changed = true;
  }
  return changed;
}

type SeedVisit = {
  offset: number;
  time: string;
  guestName: string;
  phone: string;
  technicianId: string;
  service: string;
  minutes: number;
  notes: string;
};

function seed(today: string): ParlorState {
  const visits: SeedVisit[] = [
    { offset: -96, time: "14:00", guestName: "张伟", phone: "13800001111", technicianId: "liqiang", service: "中式推拿", minutes: 60, notes: "肩颈" },
    { offset: -61, time: "16:00", guestName: "张伟", phone: "13800001111", technicianId: "liqiang", service: "肩颈专项", minutes: 45, notes: "肩颈还是僵，喜欢力度大" },
    { offset: -32, time: "15:00", guestName: "张伟", phone: "13800001111", technicianId: "liqiang", service: "中式推拿", minutes: 60, notes: "肩颈僵硬，喜欢力度大" },
    { offset: -24, time: "11:00", guestName: "李娜", phone: "13900002222", technicianId: "atai", service: "泰式拉伸", minutes: 60, notes: "" },
    { offset: -3, time: "14:00", guestName: "李娜", phone: "13900002222", technicianId: "atai", service: "泰式拉伸", minutes: 90, notes: "拉伸完觉得松" },
    { offset: -88, time: "13:00", guestName: "王芳", phone: "13700003333", technicianId: "xiaorou", service: "精油SPA", minutes: 60, notes: "喜欢手法轻" },
    { offset: -47, time: "15:30", guestName: "王芳", phone: "13700003333", technicianId: "linjie", service: "精油SPA", minutes: 90, notes: "力度要轻" },
    { offset: -40, time: "19:00", guestName: "刘洋", phone: "13611112222", technicianId: "zhou", service: "足疗", minutes: 60, notes: "足底偏酸" },
    { offset: -8, time: "19:30", guestName: "刘洋", phone: "13611112222", technicianId: "zhou", service: "足疗", minutes: 60, notes: "足底" },
    { offset: -28, time: "10:30", guestName: "赵敏", phone: "13522223333", technicianId: "xiaoya", service: "肩颈专项", minutes: 45, notes: "久坐肩颈" },
    { offset: -44, time: "18:00", guestName: "孙浩", phone: "15833334444", technicianId: "dapeng", service: "运动恢复", minutes: 60, notes: "腰，训练后酸" },
    { offset: 5, time: "18:00", guestName: "孙浩", phone: "15833334444", technicianId: "dapeng", service: "运动恢复", minutes: 60, notes: "腰" },
    { offset: -70, time: "11:30", guestName: "周婷", phone: "18644445555", technicianId: "liqiang", service: "中式推拿", minutes: 60, notes: "腰" },
    { offset: -18, time: "12:00", guestName: "周婷", phone: "18644445555", technicianId: "liqiang", service: "中式推拿", minutes: 90, notes: "腰痛，力度大" },
    { offset: -2, time: "16:30", guestName: "吴磊", phone: "15955556666", technicianId: "xiaorou", service: "精油SPA", minutes: 60, notes: "" },
    { offset: -110, time: "10:00", guestName: "陈静", phone: "13766667777", technicianId: "laohan", service: "足疗", minutes: 90, notes: "" },
    { offset: -16, time: "10:00", guestName: "陈静", phone: "13766667777", technicianId: "zhou", service: "足疗", minutes: 60, notes: "小腿沉" },
  ];
  const zhaoMinSent = addDays(today, -2);
  const zhangAsked = addDays(today, -33);
  const zhouAsked = addDays(today, -19);
  return {
    appointments: visits.map((visit) => {
      const technician = technicianById(visit.technicianId);
      if (technician === undefined) throw new Error(`missing technician ${visit.technicianId}`);
      const date = addDays(today, visit.offset);
      const clock = visit.time.replace(":", "");
      return {
        id: `apt_${visit.phone}_${date}_${clock}`,
        guestName: visit.guestName,
        phone: visit.phone,
        date,
        time: visit.time,
        durationMinutes: visit.minutes,
        technicianId: technician.id,
        technicianName: technician.name,
        service: visit.service,
        force: technician.force,
        notes: visit.notes,
        room: "",
        status: "booked",
        rescheduled: false,
        overtimeMinutes: 0,
        createdAt: `${date}T06:00:00.000Z`,
      };
    }),
    followUps: [
      {
        phone: "13522223333",
        guestName: "赵敏",
        message: "赵敏你好，上次小雅给您做过肩颈。秋天干燥，要不要再约一次？",
        createdAt: `${zhaoMinSent}T02:00:00.000Z`,
      },
    ],
    consultations: [
      {
        id: "con_zhangwei_shoulder",
        phone: "13800001111",
        guestName: "张伟",
        question: "肩颈按重点会不会更疼",
        createdAt: `${zhangAsked}T06:00:00.000Z`,
      },
      {
        id: "con_zhouting_waist",
        phone: "18644445555",
        guestName: "周婷",
        question: "腰痛能不能做力度大的推拿",
        createdAt: `${zhouAsked}T06:00:00.000Z`,
      },
    ],
    cancellations: [],
    members: seedMembers(),
    waitlist: [],
  };
}

function seedMembers(): Member[] {
  return [
    {
      phone: "13800001111",
      guestName: "张伟",
      balanceYuan: 1100,
      recharges: [{ paidYuan: 1000, creditedYuan: 1100, createdAt: "2026-01-08T02:00:00.000Z" }],
    },
    {
      phone: "13900002222",
      guestName: "李娜",
      balanceYuan: 530,
      recharges: [{ paidYuan: 500, creditedYuan: 530, createdAt: "2026-03-02T02:00:00.000Z" }],
    },
  ];
}

function normalizeAppointment(raw: unknown): { appointment: Appointment; changed: boolean } | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const item = raw as Partial<Appointment>;
  if (typeof item.id !== "string" || typeof item.phone !== "string" || typeof item.date !== "string" || typeof item.time !== "string") {
    return undefined;
  }
  const status: AppointmentStatus = item.status === "cancelled" ? "cancelled" : "booked";
  const rescheduled = item.rescheduled === true;
  const overtimeMinutes = item.overtimeMinutes === 30 ? 30 : 0;
  const room = typeof item.room === "string" ? item.room : "";
  const notes = typeof item.notes === "string" ? item.notes : "";
  const durationMinutes = item.durationMinutes === 45 || item.durationMinutes === 60 || item.durationMinutes === 90 ? item.durationMinutes : 60;
  const force: Force = item.force === "light" || item.force === "medium" || item.force === "strong" ? item.force : "medium";
  const changed =
    item.status !== status ||
    item.rescheduled !== rescheduled ||
    item.overtimeMinutes !== overtimeMinutes ||
    item.room !== room ||
    item.notes !== notes ||
    item.durationMinutes !== durationMinutes ||
    item.force !== force;
  return {
    changed,
    appointment: {
      id: item.id,
      guestName: typeof item.guestName === "string" ? item.guestName : "",
      phone: item.phone,
      date: item.date,
      time: item.time,
      durationMinutes,
      overtimeMinutes,
      technicianId: typeof item.technicianId === "string" ? item.technicianId : "",
      technicianName: typeof item.technicianName === "string" ? item.technicianName : "",
      service: typeof item.service === "string" ? item.service : "",
      force,
      notes,
      room,
      status,
      rescheduled,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    },
  };
}

function normalizeState(value: unknown): { state: ParlorState; changed: boolean } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.appointments) || !Array.isArray(record.followUps)) return undefined;
  let changed = false;
  if (!Array.isArray(record.consultations)) changed = true;
  if (!Array.isArray(record.cancellations)) changed = true;
  if (!("members" in record) || !Array.isArray(record.members)) changed = true;
  if (!Array.isArray(record.waitlist)) changed = true;

  const appointments: Appointment[] = [];
  for (const raw of record.appointments) {
    const parsed = normalizeAppointment(raw);
    if (parsed === undefined) {
      changed = true;
      continue;
    }
    if (parsed.changed) changed = true;
    appointments.push(parsed.appointment);
  }
  const state: ParlorState = {
    appointments,
    followUps: record.followUps as FollowUp[],
    consultations: Array.isArray(record.consultations) ? (record.consultations as Consultation[]) : [],
    cancellations: Array.isArray(record.cancellations) ? (record.cancellations as Cancellation[]) : [],
    members: "members" in record && Array.isArray(record.members) ? (record.members as Member[]) : seedMembers(),
    waitlist: Array.isArray(record.waitlist) ? (record.waitlist as WaitlistEntry[]) : [],
  };
  if (assignOpenRooms(state)) changed = true;
  return { state, changed };
}

export async function loadState(kv: HostKvApi, now = new Date()): Promise<ParlorState> {
  const existing = await kv.get(KEY);
  const normalized = normalizeState(existing);
  if (normalized !== undefined) {
    if (normalized.changed) await saveState(kv, normalized.state);
    return normalized.state;
  }
  const seeded = seed(shanghaiToday(now));
  assignOpenRooms(seeded);
  await saveState(kv, seeded);
  return seeded;
}

export async function saveState(kv: HostKvApi, state: ParlorState): Promise<void> {
  await kv.put(KEY, toJson(state));
}

function toJson(state: ParlorState): JsonValue {
  return JSON.parse(JSON.stringify(state)) as JsonValue;
}

export function forceLabel(force: Force): string {
  return FORCE_LABEL[force];
}

export function appointmentId(phone: string, date: string, time: string): string {
  return `apt_${phone}_${date}_${time.replace(":", "")}`;
}

export type AppointmentCard = {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  overtimeMinutes: number;
  endsAt: string;
  technicianId: string;
  technicianName: string;
  service: string;
  force: Force;
  forceLabel: string;
  notes: string;
  room: string;
  status: AppointmentStatus;
  rescheduled: boolean;
};

export function toAppointmentCard(item: Appointment): AppointmentCard {
  return {
    id: item.id,
    guestName: item.guestName,
    phone: item.phone,
    date: item.date,
    time: item.time,
    durationMinutes: item.durationMinutes,
    overtimeMinutes: item.overtimeMinutes,
    endsAt: endsAt(item.time, item.durationMinutes, item.overtimeMinutes),
    technicianId: item.technicianId,
    technicianName: item.technicianName,
    service: item.service,
    force: item.force,
    forceLabel: FORCE_LABEL[item.force],
    notes: item.notes,
    room: item.room,
    status: item.status,
    rescheduled: item.rescheduled,
  };
}
