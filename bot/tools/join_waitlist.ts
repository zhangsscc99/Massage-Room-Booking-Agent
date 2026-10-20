import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { joinWaitlist } from "../lib/desk.js";
import { loadState, normalizePhone, saveState } from "../lib/store.js";

const Duration = z.union([z.literal(45), z.literal(60), z.literal(90)]);

export default defineTool({
  description: prompt`
    技师或房间没空时，给客人留下候补。不会自动改成预约。
    如果返回 technician_free，改为直接 book_appointment。
  `,
  effect: "write",
  inputSchema: z.object({
    guestName: z.string().min(1).max(20),
    phone: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: Duration,
    technicianId: z.string(),
    service: z.string().min(2).max(30),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const result = joinWaitlist(state, { ...input, phone }, new Date());
    if (result.ok && !result.alreadyWaiting) await saveState(ctx.host.kv, state);
    if (!result.ok) return result;
    return {
      ok: true as const,
      alreadyWaiting: result.alreadyWaiting,
      entry: {
        id: result.entry.id,
        guestName: result.entry.guestName,
        phone: result.entry.phone,
        date: result.entry.date,
        time: result.entry.time,
        durationMinutes: result.entry.durationMinutes,
        technicianName: result.entry.technicianName,
        service: result.entry.service,
      },
    };
  },
});
