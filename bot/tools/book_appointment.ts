import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { placeBooking } from "../lib/desk.js";
import { loadState, normalizePhone, saveState, toAppointmentCard } from "../lib/store.js";

const Duration = z.union([z.literal(45), z.literal(60), z.literal(90)]);

export default defineTool({
  description: prompt`
    写下一条按摩预约。调用前必须先 search_technicians，并且姓名、手机号、日期、时间、时长、技师和项目都已确定。
    成功后还要调用 get_weather，不要用本工具的结果代替天气。
    单人房由本工具安排。客人已在候补名单上时，成功下单会去掉对应候补。
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
    force: z.enum(["light", "medium", "strong"]),
    notes: z.string().max(80).optional(),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const result = placeBooking(
      state,
      {
        guestName: input.guestName,
        phone,
        date: input.date,
        time: input.time,
        durationMinutes: input.durationMinutes,
        technicianId: input.technicianId,
        service: input.service,
        force: input.force,
        notes: input.notes ?? "",
      },
      new Date(),
    );
    if (result.ok) await saveState(ctx.host.kv, state);
    if (!result.ok) {
      if (result.existing !== undefined) {
        return { ok: false as const, error: result.error, code: result.code, existing: toAppointmentCard(result.existing) };
      }
      return { ok: false as const, error: result.error, code: result.code, alternatives: result.alternatives ?? [] };
    }
    return {
      ok: true as const,
      alreadyBooked: result.alreadyBooked,
      clearedWaitlist: result.clearedWaitlist,
      appointment: toAppointmentCard(result.appointment),
    };
  },
});
