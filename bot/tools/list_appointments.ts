import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { FORCE_LABEL } from "../lib/parlor.js";
import { loadState, normalizePhone, parseClock, shanghaiNowMinutes, shanghaiToday } from "../lib/store.js";

export default defineTool({
  description: "按手机号查询这位客人已有的预约。查记录或改期前先调用。",
  effect: "read",
  inputSchema: z.object({
    phone: z.string().describe("11 位手机号"),
  }),
  async execute({ phone }, ctx) {
    const normalized = normalizePhone(phone);
    if (normalized === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。" };
    const state = await loadState(ctx.host.kv);
    const today = shanghaiToday();
    const nowMinutes = shanghaiNowMinutes();
    const mine = state.appointments.filter((item) => item.phone === normalized);
    const upcoming = [];
    const past = [];
    for (const item of mine) {
      const start = parseClock(item.time) ?? 0;
      const card = {
        id: item.id,
        guestName: item.guestName,
        date: item.date,
        time: item.time,
        durationMinutes: item.durationMinutes,
        technicianName: item.technicianName,
        service: item.service,
        forceLabel: FORCE_LABEL[item.force],
        notes: item.notes,
      };
      const isPast = item.date < today || (item.date === today && start + item.durationMinutes <= nowMinutes);
      if (isPast) past.push(card);
      else upcoming.push(card);
    }
    upcoming.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    past.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    return {
      ok: true as const,
      phone: normalized,
      upcoming,
      past,
      note: mine.length === 0 ? "没有这位客人的预约。" : null,
    };
  },
});
