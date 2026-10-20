import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { rechargeMember } from "../lib/desk.js";
import { loadState, normalizePhone, saveState } from "../lib/store.js";

export default defineTool({
  description: prompt`
    前台已经收到 500 或 1000 元现金或扫码后，给会员入账。充 500 到账 530，充 1000 到账 1100。
    客人只是在问规则时不要调用。对话里不能扣余额。
  `,
  effect: "write",
  inputSchema: z.object({
    phone: z.string(),
    paidYuan: z.union([z.literal(500), z.literal(1000)]),
    guestName: z.string().min(1).max(20).optional(),
  }),
  async execute(input, ctx) {
    const phone = normalizePhone(input.phone);
    if (phone === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    const result = rechargeMember(state, phone, input.paidYuan, input.guestName ?? "", new Date());
    if (result.ok) await saveState(ctx.host.kv, state);
    return result;
  },
});
