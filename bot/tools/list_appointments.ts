import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { loadState, normalizePhone, occupiedMinutes, parseClock, shanghaiNowMinutes, shanghaiToday, toAppointmentCard } from "../lib/store.js";

export default defineTool({
  description: "按手机号查询这位客人已有的预约，含房间、加钟和是否已改期。查记录、取消或改期前先调用。",
  effect: "read",
  inputSchema: z.object({
    phone: z.string().describe("11 位手机号"),
  }),
  async execute({ phone }, ctx) {
    const normalized = normalizePhone(phone);
    if (normalized === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const today = shanghaiToday();
    const nowMinutes = shanghaiNowMinutes();
    const mine = state.appointments.filter((item) => item.phone === normalized);
    const upcoming = [];
    const past = [];
    const cancelled = [];
    for (const item of mine) {
      const card = toAppointmentCard(item);
      if (item.status === "cancelled") {
        cancelled.push(card);
        continue;
      }
      const start = parseClock(item.time) ?? 0;
      const isPast = item.date < today || (item.date === today && start + occupiedMinutes(item) <= nowMinutes);
      if (isPast) past.push(card);
      else upcoming.push(card);
    }
    upcoming.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    past.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    cancelled.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    return {
      ok: true as const,
      phone: normalized,
      upcoming,
      past,
      cancelled: cancelled.slice(0, 8),
      note: mine.length === 0 ? "没有这位客人的预约。" : null,
    };
  },
});
