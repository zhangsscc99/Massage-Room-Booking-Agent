import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { searchKnowledge, TOPIC_CHUNKING } from "../lib/retrieve.js";

export default defineTool({
  description: prompt`
    从舒缓阁的店内资料里检索原文。回答价格、地址、营业时间、项目、支付和注意事项之前必须先调用。
    只引用返回的 text，不要编造数字。分块策略是 topic-doc：一篇主题一块。
  `,
  effect: "read",
  inputSchema: z.object({
    query: z.string().min(1).describe("客人的问题原文"),
  }),
  async execute({ query }) {
    const matches = searchKnowledge(query);
    if (matches.length === 0) {
      return {
        ok: true as const,
        chunking: TOPIC_CHUNKING,
        storage: "repo-file" as const,
        matches: [],
        note: "知识库没有直接命中。请说明不确定，并建议联系前台 010-88886666。",
      };
    }
    return { ok: true as const, chunking: TOPIC_CHUNKING, storage: "repo-file" as const, matches };
  },
});
