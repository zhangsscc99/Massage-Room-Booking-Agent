import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { daysBetween, loadState, normalizePhone, saveState, shanghaiToday } from "../lib/store.js";

export default defineTool({
  description: prompt`
    保存一条已经写好的回访问候，避免七天内重复联系同一位客人。
    先 review_guests，并且只保存 needsFollowUp 为 true 的客人。
  `,
  effect: "write",
  inputSchema: z.object({
    phone: z.string(),
    message: z.string().min(8).max(200).describe("发给客人的问候原文"),
  }),
  async execute({ phone, message }, ctx) {
    const normalized = normalizePhone(phone);
    if (normalized === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。" };
    const state = await loadState(ctx.host.kv);
    const history = state.appointments.filter((item) => item.phone === normalized);
    if (history.length === 0) return { ok: false as const, error: "没有这位客人的预约记录，不能回访。" };
    const guestName = history[history.length - 1]?.guestName ?? "客人";
    const today = shanghaiToday();
    const recent = state.followUps.find((item) => item.phone === normalized && daysBetween(today, item.createdAt.slice(0, 10)) < 7);
    if (recent !== undefined) {
      return { ok: true as const, skipped: true, reason: "already_sent", phone: normalized, guestName };
    }
    state.followUps.push({
      phone: normalized,
      guestName,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });
    await saveState(ctx.host.kv, state);
    return { ok: true as const, skipped: false, phone: normalized, guestName };
  },
});
