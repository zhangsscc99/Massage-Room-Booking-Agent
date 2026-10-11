import { knowledge, type KnowledgeDoc } from "./parlor.js";

export const TOPIC_CHUNKING = "topic-doc";

const INTENTS: Array<{ id: string; words: string[] }> = [
  { id: "prices", words: ["多少钱", "价格", "价目", "收费", "费用"] },
  { id: "store", words: ["地址", "在哪", "营业", "电话", "怎么走", "几点开门"] },
  { id: "policy", words: ["取消", "改期", "迟到", "爽约", "预约规则"] },
  { id: "payment", words: ["支付", "微信", "支付宝", "会员", "充值", "付款"] },
  { id: "caution", words: ["孕妇", "高血压", "酒", "饭后", "未满", "16"] },
  { id: "services", words: ["什么项目", "项目介绍", "有哪些项目"] },
  { id: "overtime", words: ["加钟", "超时", "延长"] },
  { id: "parking", words: ["停车", "车位", "开车", "停车场"] },
  { id: "room", words: ["房间", "双人", "包间", "单人房"] },
  { id: "dress", words: ["衣服", "穿什么", "短裤", "浴衣", "毛巾"] },
  { id: "invoice", words: ["发票", "报销", "税号"] },
];

export type KnowledgeMatch = {
  id: string;
  title: string;
  text: string;
};

export function searchKnowledge(query: string): KnowledgeMatch[] {
  return knowledge
    .map((doc) => ({ doc, score: scoreDoc(query, doc) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      id: item.doc.id,
      title: item.doc.title,
      text: item.doc.text,
    }));
}

function scoreDoc(query: string, doc: KnowledgeDoc): number {
  const compact = query.replace(/\s+/g, "");
  const hay = `${doc.title}\n${doc.text}`;
  let score = 0;
  if (compact.length >= 2 && hay.includes(compact)) score += 6;
  if (doc.title.length > 0 && compact.includes(doc.title)) score += 6;
  for (let index = 0; index < compact.length - 1; index += 1) {
    const gram = compact.slice(index, index + 2);
    if (hay.includes(gram)) score += 1;
  }
  for (const rule of INTENTS) {
    if (rule.id === doc.id && rule.words.some((word) => compact.includes(word))) score += 8;
  }
  return score;
}

export type RetrievalCheck = {
  query: string;
  expectId: string;
  expectText?: string;
  topId: string | null;
  pass: boolean;
};

const GOLDENS: Array<{ query: string; expectId: string; expectText?: string }> = [
  { query: "中式推拿 60 分钟多少钱", expectId: "prices", expectText: "60分钟298" },
  { query: "开车来有车位吗", expectId: "parking" },
  { query: "加钟怎么收费", expectId: "overtime" },
  { query: "孕妇能不能做力度大的推拿", expectId: "caution" },
  { query: "能开发票吗", expectId: "invoice" },
  { query: "有双人房吗", expectId: "room" },
  { query: "需要自己带毛巾吗", expectId: "dress" },
];

export function checkRetrieval(): { ok: boolean; checks: RetrievalCheck[] } {
  const checks = GOLDENS.map((golden) => {
    const top = searchKnowledge(golden.query)[0];
    const topId = top?.id ?? null;
    const textOk = golden.expectText === undefined || (top?.text.includes(golden.expectText) ?? false);
    return {
      query: golden.query,
      expectId: golden.expectId,
      expectText: golden.expectText,
      topId,
      pass: topId === golden.expectId && textOk,
    };
  });
  return { ok: checks.every((item) => item.pass), checks };
}
