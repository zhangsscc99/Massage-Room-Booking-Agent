import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { knowledge, type KnowledgeDoc } from "../lib/parlor.js";

const INTENTS: Array<{ id: string; words: string[] }> = [
  { id: "prices", words: ["多少钱", "价格", "价目", "收费", "费用", "多少"] },
  { id: "store", words: ["地址", "在哪", "营业", "电话", "怎么走", "几点"] },
  { id: "policy", words: ["取消", "改期", "迟到", "爽约", "预约规则"] },
  { id: "payment", words: ["支付", "微信", "支付宝", "会员", "充值", "付款"] },
  { id: "caution", words: ["孕妇", "高血压", "酒", "饭后", "注意", "能不能做"] },
  { id: "services", words: ["项目", "中式", "泰式", "精油", "足疗", "肩颈", "运动"] },
];

export default defineTool({
  description: prompt`
    从舒缓阁的店内资料里检索原文。回答价格、地址、营业时间、项目、支付和注意事项之前必须先调用。
    只引用返回的 text，不要编造数字。
  `,
  effect: "read",
  inputSchema: z.object({
    query: z.string().min(1).describe("客人的问题原文"),
  }),
  async execute({ query }) {
    const ranked = knowledge
      .map((doc) => ({ doc, score: scoreDoc(query, doc) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => ({
        id: item.doc.id,
        title: item.doc.title,
        text: item.doc.text,
      }));
    if (ranked.length === 0) {
      return {
        ok: true as const,
        matches: [],
        note: "知识库没有直接命中。请说明不确定，并建议联系前台 010-88886666。",
      };
    }
    return { ok: true as const, matches: ranked };
  },
});

function scoreDoc(query: string, doc: KnowledgeDoc): number {
  const compact = query.replace(/\s+/g, "");
  const hay = `${doc.title}\n${doc.text}`;
  let score = 0;
  if (compact.length >= 2 && hay.includes(compact)) score += 6;
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    if (hay.includes(gram)) score += 1;
  }
  for (const rule of INTENTS) {
    if (rule.id === doc.id && rule.words.some((word) => compact.includes(word))) score += 8;
  }
  return score;
}
