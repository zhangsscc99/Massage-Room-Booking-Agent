import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { describeDay } from "../lib/desk.js";
import { loadState, shanghaiToday } from "../lib/store.js";

export default defineTool({
  description: prompt`
    查看某一天的预约忙闲。默认不返回客人姓名。
    客人问忙不忙时 includeGuests 必须为 false。只有对方说明自己是前台要排班时才设为 true。
    不返回手机号。
  `,
  effect: "read",
  inputSchema: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    includeGuests: z.boolean().optional(),
  }),
  async execute(input, ctx) {
    const state = await loadState(ctx.host.kv);
    const date = input.date ?? shanghaiToday();
    return { ok: true as const, ...describeDay(state, date, input.includeGuests ?? false) };
  },
});
