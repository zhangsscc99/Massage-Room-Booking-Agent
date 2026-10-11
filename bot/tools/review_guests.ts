import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { FORCE_LABEL, type Force } from "../lib/parlor.js";
import { daysBetween, loadState, shanghaiToday, type Appointment, type ParlorState } from "../lib/store.js";

export default defineTool({
  description: prompt`
    查看哪些客人该回访。返回季节、技师和健康相关的提示，供你写问候。
    只给 needsFollowUp 为 true 的客人写消息。不要用本工具直接发送。
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
    const guests = groupGuests(state).map((group) => toGuest(group, state, asOf, staleDays));
    guests.sort((a, b) => Number(b.needsFollowUp) - Number(a.needsFollowUp) || b.daysSinceLastVisit - a.daysSinceLastVisit);
    return {
      ok: true as const,
      asOf,
      staleDays,
      seasonal: seasonal(Number(asOf.slice(5, 7))),
      guests,
    };
  },
});

function groupGuests(state: ParlorState): Appointment[][] {
  const byPhone = new Map<string, Appointment[]>();
  for (const item of state.appointments) {
    const list = byPhone.get(item.phone) ?? [];
    list.push(item);
    byPhone.set(item.phone, list);
  }
  return [...byPhone.values()];
}

function toGuest(visits: Appointment[], state: ParlorState, asOf: string, staleDays: number) {
  const ordered = [...visits].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const latest = ordered[ordered.length - 1] ?? visits[0];
  const hasUpcoming = ordered.some((item) => item.date >= asOf);
  const lastPast = [...ordered].reverse().find((item) => item.date < asOf) ?? latest;
  const daysSinceLastVisit = daysBetween(asOf, lastPast.date);
  const recentFollowUp = state.followUps.some((item) => {
    if (item.phone !== latest.phone) return false;
    const sentOn = item.createdAt.slice(0, 10);
    return daysBetween(asOf, sentOn) >= 0 && daysBetween(asOf, sentOn) < 7;
  });
  let skipReason: string | null = null;
  if (hasUpcoming) skipReason = "upcoming_visit";
  else if (recentFollowUp) skipReason = "recent_follow_up";
  else if (daysSinceLastVisit < staleDays) skipReason = "recent_visit";
  const favorite = favoriteTechnician(ordered);
  const questions = state.consultations
    .filter((item) => item.phone === latest.phone)
    .map((item) => item.question)
    .join(" ");
  const text = `${ordered.map((item) => `${item.service} ${item.notes}`).join(" ")} ${questions}`;
  return {
    phone: latest.phone,
    guestName: latest.guestName,
    visits: ordered.length,
    lastVisit: lastPast.date,
    daysSinceLastVisit,
    needsFollowUp: skipReason === null,
    skipReason,
    favoriteTechnician: favorite.name,
    force: favorite.force,
    forceLabel: FORCE_LABEL[favorite.force],
    lastService: lastPast.service,
    signals: {
      seasonal: seasonal(Number(asOf.slice(5, 7))),
      technician: lastPast.date < asOf
        ? `上次技师是${lastPast.technicianName}，偏好${FORCE_LABEL[lastPast.force]}。`
        : `已有即将到来的预约，技师是${lastPast.technicianName}。`,
      health: healthSignal(text),
    },
  };
}

function favoriteTechnician(visits: Appointment[]): { name: string; force: Force } {
  const counts = new Map<string, { name: string; force: Force; count: number; latest: string }>();
  for (const item of visits) {
    const current = counts.get(item.technicianId) ?? {
      name: item.technicianName,
      force: item.force,
      count: 0,
      latest: item.date,
    };
    current.count += 1;
    if (item.date >= current.latest) {
      current.latest = item.date;
      current.force = item.force;
      current.name = item.technicianName;
    }
    counts.set(item.technicianId, current);
  }
  const winner = [...counts.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))[0];
  if (winner === undefined) return { name: visits[0]?.technicianName ?? "技师", force: visits[0]?.force ?? "medium" };
  return { name: winner.name, force: winner.force };
}

function healthSignal(text: string): string {
  if (text.includes("肩颈")) return "上次记录提到肩颈，可以问最近是否还僵，不要下诊断。";
  if (text.includes("腰")) return "上次记录提到腰背，可以问久坐是否加重，不要下诊断。";
  if (text.includes("足")) return "上次做过足疗，可以问是否还想按上次的项目。";
  return "按上次项目问候即可，不要编造健康状况。";
}

function seasonal(month: number): string {
  if (month >= 3 && month <= 5) return "春季多湿，适合问肩颈是否发紧。";
  if (month >= 6 && month <= 8) return "夏季炎热，适合提醒补水和放松。";
  if (month >= 9 && month <= 11) return "秋季干燥，适合问是否需要润燥放松。";
  return "冬季偏冷，适合提醒保暖后再做力度大的项目。";
}
