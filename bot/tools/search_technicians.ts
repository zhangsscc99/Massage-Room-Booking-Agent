import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import {
  FORCE_LABEL,
  GENDER_LABEL,
  technicians,
  type Force,
  type Technician,
} from "../lib/parlor.js";
import {
  loadState,
  parseClock,
  shanghaiToday,
  slotFits,
  technicianBusy,
} from "../lib/store.js";

type TechnicianCard = {
  id: string;
  name: string;
  gender: string;
  force: Force;
  forceLabel: string;
  years: number;
  services: string[];
  match: string;
  blurb: string;
};

const Duration = z.union([z.literal(45), z.literal(60), z.literal(90)]);

export default defineTool({
  description: prompt`
    按项目、力度和时段查找技师。available 已按匹配度从高到低排序。
    客人要预约时先调用本工具。未指定技师时，下单用 available 的第一位。
    给出日期、开始时间和时长时，会排除该时段已被预约的技师。
  `,
  effect: "read",
  inputSchema: z.object({
    query: z.string().optional().describe("客人的项目或偏好原文，例如中式推拿、力度大"),
    force: z.enum(["light", "medium", "strong"]).optional().describe("light 轻柔，medium 适中，strong 力度大"),
    gender: z.enum(["male", "female"]).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("整点或半点，例如 15:00"),
    durationMinutes: Duration.optional(),
  }),
  async execute(input, ctx) {
    const slotCount = [input.date, input.time, input.durationMinutes].filter((value) => value !== undefined).length;
    if (slotCount > 0 && slotCount < 3) {
      return { ok: false as const, error: "查空闲需要同时提供日期、开始时间和时长（45、60 或 90）。" };
    }
    const today = shanghaiToday();
    let start: number | undefined;
    if (input.date !== undefined && input.time !== undefined && input.durationMinutes !== undefined) {
      if (input.date < today) return { ok: false as const, error: "不能查询已经过去的日期。" };
      start = parseClock(input.time);
      if (start === undefined) return { ok: false as const, error: "开始时间请用整点或半点，例如 15:00。" };
      if (!slotFits(start, input.durationMinutes)) {
        return { ok: false as const, error: "营业时间是 10:00 到 22:00，项目必须在 22:00 前结束。" };
      }
    }

    const state = await loadState(ctx.host.kv);
    const preferred = input.force ?? inferForce(input.query);
    const ranked = technicians
      .filter((tech) => input.force === undefined || tech.force === input.force)
      .filter((tech) => input.gender === undefined || tech.gender === input.gender)
      .map((tech) => ({ tech, score: scoreTechnician(tech, input.query, preferred) }))
      .sort((a, b) => b.score - a.score || b.tech.years - a.tech.years);

    const available: TechnicianCard[] = [];
    const unavailable: Array<TechnicianCard & { reason: string }> = [];
    for (const item of ranked) {
      const card: TechnicianCard = {
        id: item.tech.id,
        name: item.tech.name,
        gender: GENDER_LABEL[item.tech.gender],
        force: item.tech.force,
        forceLabel: FORCE_LABEL[item.tech.force],
        years: item.tech.years,
        services: item.tech.services,
        match: item.tech.specialties.slice(0, 3).join("、"),
        blurb: item.tech.blurb,
      };
      const busy =
        start !== undefined &&
        input.date !== undefined &&
        input.durationMinutes !== undefined &&
        technicianBusy(state, item.tech.id, input.date, start, input.durationMinutes);
      if (busy) unavailable.push({ ...card, reason: "该时段已有预约" });
      else available.push(card);
    }

    return {
      ok: true as const,
      checkedAvailability: start !== undefined,
      assumedForce: preferred ?? null,
      available,
      unavailable,
    };
  },
});

function inferForce(query: string | undefined): Force | undefined {
  if (query === undefined) return undefined;
  if (/力度大|大力|重一点|按重点/.test(query)) return "strong";
  if (/轻柔|手法轻|轻轻|力度小/.test(query)) return "light";
  if (/适中|中等力度/.test(query)) return "medium";
  return undefined;
}

function scoreTechnician(tech: Technician, query: string | undefined, preferred: Force | undefined): number {
  let score = 1;
  if (preferred !== undefined && tech.force === preferred) score += 6;
  if (query === undefined || query.trim().length === 0) return score + tech.years / 100;
  if (query.includes(tech.name)) score += 8;
  for (const term of [...tech.specialties, ...tech.services]) {
    if (query.includes(term)) score += 5;
  }
  return score + tech.years / 100;
}
