import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { loadState, normalizePhone, saveState } from "../lib/store.js";

export default defineTool({
  description: prompt`
    把客人刚问过的店内问题记下来，供以后回访时参考。
    回答咨询之后调用。没有手机号时省略 phone。
  `,
  effect: "write",
  inputSchema: z.object({
    question: z.string().min(2).max(200).describe("客人的问题原文"),
    phone: z.string().optional(),
    guestName: z.string().min(1).max(20).optional(),
  }),
  async execute(input, ctx) {
    const question = input.question.trim();
    let phone = "";
    if (input.phone !== undefined && input.phone.trim().length > 0) {
      const normalized = normalizePhone(input.phone);
      if (normalized === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。" };
      phone = normalized;
    }
    const state = await loadState(ctx.host.kv);
    const known = phone.length > 0 ? state.appointments.find((item) => item.phone === phone) : undefined;
    const guestName = (input.guestName ?? known?.guestName ?? "").trim();
    const duplicate = state.consultations.find((item) => item.phone === phone && item.question === question);
    if (duplicate !== undefined) {
      return { ok: true as const, alreadyRecorded: true, id: duplicate.id };
    }
    const record = {
      id: `con_${phone || "anon"}_${Date.now().toString(36)}`,
      phone,
      guestName,
      question,
      createdAt: new Date().toISOString(),
    };
    state.consultations.push(record);
    await saveState(ctx.host.kv, state);
    return { ok: true as const, alreadyRecorded: false, id: record.id, phone, guestName };
  },
});