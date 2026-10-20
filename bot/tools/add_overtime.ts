import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { addOvertime } from "../lib/desk.js";
import { loadState, normalizePhone, saveState, toAppointmentCard } from "../lib/store.js";

export default defineTool({
  description: prompt`
    给一条已有预约加 30 分钟。每条只能加一次，加完必须在 22:00 前结束，技师和房间都不能冲突。
    价格用返回的 priceYuan，不要自己编。不要用本工具代替新预约。
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
    const result = addOvertime(state, phone, input.appointmentId, new Date());
    if (result.ok && !result.alreadyAdded) await saveState(ctx.host.kv, state);
    if (!result.ok) return result;
    return {
      ok: true as const,
      alreadyAdded: result.alreadyAdded,
      priceYuan: result.priceYuan,
      room: result.room,
      movedRoom: result.movedRoom,
      endsAt: result.endsAt,
      appointment: toAppointmentCard(result.appointment),
    };
  },
});
