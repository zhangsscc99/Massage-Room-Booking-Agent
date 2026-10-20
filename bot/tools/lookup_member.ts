import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { lookupMember } from "../lib/desk.js";
import { loadState, normalizePhone } from "../lib/store.js";

export default defineTool({
  description: prompt`
    查询会员余额。不是会员时 member 为 false，并给出两档充值。
    这里只查询，不扣款。余额要到店划扣。
  `,
  effect: "read",
  inputSchema: z.object({
    phone: z.string(),
  }),
  async execute({ phone }, ctx) {
    const normalized = normalizePhone(phone);
    if (normalized === undefined) return { ok: false as const, error: "手机号需要是 11 位中国大陆号码。", code: "bad_phone" };
    const state = await loadState(ctx.host.kv);
    return lookupMember(state, normalized);
  },
});
