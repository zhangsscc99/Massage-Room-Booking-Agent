import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { planFollowUps } from "../lib/followups.js";
import { loadState, shanghaiToday } from "../lib/store.js";

export default defineTool({
  description: prompt`
    查看哪些客人该回访。返回季节、技师和健康相关的提示，供你写问候。
    只给 needsFollowUp 为 true 的客人写消息。不要用本工具直接发送。
    已取消的预约不算出勤，也不算即将到店。
  `,
  effect: "read",
  inputSchema: z.object({
    staleDays: z.number().int().min(1).max(180).optional().describe("多少天没来算该回访，默认 14"),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("按哪一天判断，默认今天（北京）"),
  }),
  async execute(input, ctx) {
    const asOf = input.asOf ?? shanghaiToday();
    const staleDays = input.staleDays ?? 14;
    const state = await loadState(ctx.host.kv);
    return {
      ok: true as const,
      chunking: "guest-history" as const,
      storage: "host-kv" as const,
      ...planFollowUps(state, asOf, staleDays),
    };
  },
});
