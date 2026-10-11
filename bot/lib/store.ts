import type { HostKvApi, JsonValue } from "@cursor/bdk";
import {
  CLOSE_MIN,
  FORCE_LABEL,
  OPEN_MIN,
  technicianById,
  type Force,
} from "./parlor.js";

export type Appointment = {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  technicianId: string;
  technicianName: string;
  service: string;
  force: Force;
  notes: string;
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

export type ParlorState = {
  appointments: Appointment[];
  followUps: FollowUp[];
  consultations: Consultation[];
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
): boolean {
  return state.appointments.some((item) => {
    if (item.technicianId !== technicianId || item.date !== date) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, item.durationMinutes);
  });
}

export function guestBusy(
  state: ParlorState,
  phone: string,
  date: string,
  start: number,
  duration: number,
): Appointment | undefined {
  return state.appointments.find((item) => {
    if (item.phone !== phone || item.date !== date) return false;
    const other = parseClock(item.time);
    if (other === undefined) return false;
    return overlaps(start, duration, other, item.durationMinutes);
  });
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
  };
}

function isState(value: unknown): value is ParlorState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as ParlorState;
  if (!Array.isArray(record.appointments) || !Array.isArray(record.followUps)) return false;
  if (!Array.isArray(record.consultations)) record.consultations = [];
  return true;
}

export async function loadState(kv: HostKvApi, now = new Date()): Promise<ParlorState> {
  const existing = await kv.get(KEY);
  if (isState(existing)) return existing;
  const seeded = seed(shanghaiToday(now));
  await kv.put(KEY, toJson(seeded));
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
