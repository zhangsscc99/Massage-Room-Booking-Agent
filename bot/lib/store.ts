import type { HostKvApi, JsonValue } from "@cursor/bdk";
import {
  CLOSE_MIN,
  FORCE_LABEL,
  OPEN_MIN,
  technicians,
  type Force,
  type Technician,
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

export type ParlorState = {
  appointments: Appointment[];
  followUps: FollowUp[];
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

function seed(today: string): ParlorState {
  const samples: Array<{
    offset: number;
    guestName: string;
    phone: string;
    technician: Technician;
    service: string;
    notes: string;
  }> = [
    {
      offset: -30,
      guestName: "张伟",
      phone: "13800001111",
      technician: technicians[0],
      service: "中式推拿",
      notes: "肩颈僵硬，喜欢力度大",
    },
    {
      offset: -3,
      guestName: "李娜",
      phone: "13900002222",
      technician: technicians[2],
      service: "泰式拉伸",
      notes: "",
    },
    {
      offset: -45,
      guestName: "王芳",
      phone: "13700003333",
      technician: technicians[1],
      service: "精油SPA",
      notes: "喜欢手法轻",
    },
  ];
  return {
    appointments: samples.map((sample) => {
      const date = addDays(today, sample.offset);
      return {
        id: `apt_${sample.phone}_${date}_1400`,
        guestName: sample.guestName,
        phone: sample.phone,
        date,
        time: "14:00",
        durationMinutes: 60,
        technicianId: sample.technician.id,
        technicianName: sample.technician.name,
        service: sample.service,
        force: sample.technician.force,
        notes: sample.notes,
        createdAt: `${date}T06:00:00.000Z`,
      };
    }),
    followUps: [],
  };
}

function isState(value: unknown): value is ParlorState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as { appointments?: unknown; followUps?: unknown };
  return Array.isArray(record.appointments) && Array.isArray(record.followUps);
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
