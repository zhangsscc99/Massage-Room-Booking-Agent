import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { rescheduleAppointment } from "../lib/desk.js";
import { loadState, normalizePhone, saveState, toAppointmentCard } from "../lib/store.js";

const Duration = z.union([z.literal(45), z.literal(60), z.literal(90)]);

export default defineTool({
  description: prompt`
    把一条预约改到新的日期或时间。每条预约只能免费改一次，且要在原开始时间前至少 2 小时。
    先 list_appointments 和 search_technicians。成功后还要调用 get_weather。
  `,
  effect: "write",
  inputSchema: z.object({
    phone: z.string(),
    appointmentId: z.string().min(4),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: Duration,
    technicianId: z.string(),
    service: z.string().min(2).max(30),
    notes: z.string().max(80).optional(),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const result = rescheduleAppointment(state, { ...input, phone }, new Date());
    if (result.ok && !result.unchanged) await saveState(ctx.host.kv, state);
    if (!result.ok) return { ok: false as const, error: result.error, code: result.code, alternatives: result.alternatives ?? [] };
    return { ok: true as const, unchanged: result.unchanged, appointment: toAppointmentCard(result.appointment) };
  },
});
