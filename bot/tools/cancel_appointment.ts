import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { cancelAppointment } from "../lib/desk.js";
import { loadState, normalizePhone, saveState, toAppointmentCard } from "../lib/store.js";

export default defineTool({
  description: prompt`
    取消一条还未开始的预约。开始前不足 2 小时会拒绝。
    先 list_appointments，用返回的 id。成功时看 waitlistCount，不要向客人念出候补者的姓名。
  `,
  effect: "write",
  inputSchema: z.object({
    phone: z.string(),
    appointmentId: z.string().min(4),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const result = cancelAppointment(state, phone, input.appointmentId, new Date());
    if (result.ok && !result.alreadyCancelled) await saveState(ctx.host.kv, state);
    if (!result.ok) return result;
    return {
      ok: true as const,
      alreadyCancelled: result.alreadyCancelled,
      waitlistCount: result.waitlistCount,
      appointment: toAppointmentCard(result.appointment),
    };
  },
});
