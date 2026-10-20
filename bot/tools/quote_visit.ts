import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { quoteVisit } from "../lib/desk.js";

const Duration = z.union([z.literal(45), z.literal(60), z.literal(90)]);

export default defineTool({
  description: prompt`
    计算某个项目在指定时长下的价格。withOvertime 为 true 时加上一次 30 分钟加钟。
    总价用 totalYuan，不要自己加。单项价目仍可先 search_knowledge。
  `,
  effect: "read",
  inputSchema: z.object({
    service: z.string().min(2).max(30),
    durationMinutes: Duration,
    withOvertime: z.boolean().optional(),
  }),
  async execute(input) {
    return quoteVisit(input.service, input.durationMinutes, input.withOvertime ?? false);
  },
});
