import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { FORCE_LABEL, technicianById, technicians } from "../lib/parlor.js";
import {
  appointmentId,
  guestBusy,
  loadState,
  normalizePhone,
  parseClock,
  saveState,
  shanghaiToday,
  slotFits,
  technicianBusy,
  addDays,
} from "../lib/store.js";

export default defineTool({
  description: prompt`
    写下一条按摩预约。调用前必须先 search_technicians，并且姓名、手机号、日期、时间、时长、技师和项目都已确定。
    成功后还要调用 get_weather，不要用本工具的结果代替天气。
  `,
  effect: "write",
  inputSchema: z.object({
    guestName: z.string().min(1).max(20),
    phone: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.union([z.literal(45), z.literal(60), z.literal(90)]),
    technicianId: z.string(),
    service: z.string().min(2).max(30),
    force: z.enum(["light", "medium", "strong"]),
    notes: z.string().max(80).optional(),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。" };
    const guestName = input.guestName.trim();
    if (guestName.length === 0) return { ok: false as const, error: "需要客人姓名。" };
    const today = shanghaiToday();
    if (input.date < today) return { ok: false as const, error: "不能预约已经过去的日期。" };
    if (input.date > addDays(today, 90)) return { ok: false as const, error: "最多预约 90 天以内。" };
    const start = parseClock(input.time);
    if (start === undefined) return { ok: false as const, error: "开始时间请用整点或半点，例如 15:00。" };
    if (!slotFits(start, input.durationMinutes)) {
      return { ok: false as const, error: "营业时间是 10:00 到 22:00，项目必须在 22:00 前结束。" };
    }
    const technician = technicianById(input.technicianId);
    if (technician === undefined) return { ok: false as const, error: "没有这位技师，请改用 search_technicians 返回的 id。" };

    const state = await loadState(ctx.host.kv);
    const id = appointmentId(phone, input.date, input.time);
    const existing = state.appointments.find((item) => item.id === id);
    if (existing !== undefined && existing.technicianId === technician.id) {
      return { ok: true as const, alreadyBooked: true, appointment: present(existing) };
    }
    const guestHit = guestBusy(state, phone, input.date, start, input.durationMinutes);
    if (guestHit !== undefined) {
      return {
        ok: false as const,
        error: "这位客人在该时段已有预约。",
        existing: present(guestHit),
      };
    }
    if (technicianBusy(state, technician.id, input.date, start, input.durationMinutes)) {
      const alternatives = technicians
        .filter((item) => item.id !== technician.id && !technicianBusy(state, item.id, input.date, start, input.durationMinutes))
        .sort((a, b) => Number(b.force === input.force) - Number(a.force === input.force) || b.years - a.years)
        .slice(0, 3)
        .map((item) => ({ id: item.id, name: item.name, forceLabel: FORCE_LABEL[item.force] }));
      return { ok: false as const, error: "该技师在这个时段已有预约。", alternatives };
    }

    const appointment = {
      id,
      guestName,
      phone,
      date: input.date,
      time: input.time,
      durationMinutes: input.durationMinutes,
      technicianId: technician.id,
      technicianName: technician.name,
      service: input.service.trim(),
      force: input.force,
      notes: (input.notes ?? "").trim(),
      createdAt: new Date().toISOString(),
    };
    state.appointments.push(appointment);
    await saveState(ctx.host.kv, state);
    return { ok: true as const, alreadyBooked: false, appointment: present(appointment) };
  },
});

function present(item: {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  technicianId: string;
  technicianName: string;
  service: string;
  force: "light" | "medium" | "strong";
  notes: string;
}) {
  return {
    id: item.id,
    guestName: item.guestName,
    phone: item.phone,
    date: item.date,
    time: item.time,
    durationMinutes: item.durationMinutes,
    technicianId: item.technicianId,
    technicianName: item.technicianName,
    service: item.service,
    force: item.force,
    forceLabel: FORCE_LABEL[item.force],
    notes: item.notes,
  };
}
