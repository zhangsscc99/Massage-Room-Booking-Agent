// 示例门店。换成真实技师、价目和文案时只改这个文件。

export const PARLOR = "舒缓阁";
export const CITY = "北京";
export const FRONT_DESK = "010-88886666";
export const OPEN_MIN = 10 * 60;
export const CLOSE_MIN = 22 * 60;

export type Force = "light" | "medium" | "strong";
export type Gender = "male" | "female";

export const FORCE_LABEL: Record<Force, string> = {
  light: "轻柔",
  medium: "适中",
  strong: "力度大",
};

export const GENDER_LABEL: Record<Gender, string> = {
  male: "男",
  female: "女",
};

export type Technician = {
  id: string;
  name: string;
  gender: Gender;
  force: Force;
  years: number;
  specialties: string[];
  services: string[];
  blurb: string;
};

export const technicians: Technician[] = [
  {
    id: "liqiang",
    name: "力强",
    gender: "male",
    force: "strong",
    years: 12,
    specialties: ["力度大", "中式推拿", "肩颈", "腰背"],
    services: ["中式推拿", "肩颈专项"],
    blurb: "力度偏大，适合肩颈和腰背酸痛。",
  },
  {
    id: "xiaorou",
    name: "晓柔",
    gender: "female",
    force: "light",
    years: 6,
    specialties: ["轻柔", "精油SPA", "放松"],
    services: ["精油SPA"],
    blurb: "手法轻，精油放松，不适合大力推拿。",
  },
  {
    id: "atai",
    name: "阿泰",
    gender: "male",
    force: "medium",
    years: 8,
    specialties: ["泰式拉伸", "关节"],
    services: ["泰式拉伸"],
    blurb: "泰式拉伸，力度适中。",
  },
  {
    id: "zhou",
    name: "周师傅",
    gender: "male",
    force: "strong",
    years: 15,
    specialties: ["足疗", "中式推拿"],
    services: ["足疗", "中式推拿"],
    blurb: "足疗为主，也能做力度大的中式推拿。",
  },
  {
    id: "xiaoya",
    name: "小雅",
    gender: "female",
    force: "medium",
    years: 5,
    specialties: ["肩颈", "手法适中"],
    services: ["肩颈专项"],
    blurb: "肩颈专项，力度适中。",
  },
  {
    id: "dapeng",
    name: "大鹏",
    gender: "male",
    force: "strong",
    years: 7,
    specialties: ["运动恢复", "腰背", "力度大"],
    services: ["运动恢复"],
    blurb: "运动后的腰背恢复，力度偏大。",
  },
];

export function technicianById(id: string): Technician | undefined {
  return technicians.find((item) => item.id === id);
}

export type KnowledgeDoc = {
  id: string;
  title: string;
  text: string;
};

export const knowledge: KnowledgeDoc[] = [
  {
    id: "store",
    title: "门店与营业",
    text: "舒缓阁在北京市朝阳区工体北路88号2层。营业时间每天10:00到22:00，项目必须在22:00前结束。地铁10号线团结湖站B口步行8分钟。前台电话010-88886666。门店所在城市是北京。",
  },
  {
    id: "prices",
    title: "价目",
    text: "舒缓阁价目，到店支付，单位元。中式推拿：60分钟298，90分钟398。泰式拉伸：60分钟358，90分钟468。精油SPA：60分钟328，90分钟438。足疗：60分钟198。肩颈专项：45分钟168。运动恢复：60分钟368。会员充值1000送100。价格含基础茶水，不含加钟。",
  },
  {
    id: "policy",
    title: "预约与取消",
    text: "预约需要姓名、11位手机号、日期、开始时间（整点或半点）、时长和项目或力度偏好。时长只有45、60、90分钟。可提前2小时免费改期一次。迟到超过15分钟，按剩余时间服务。取消需提前2小时，否则记一次爽约。对话里不能直接取消或改掉旧预约，请联系前台010-88886666。",
  },
  {
    id: "payment",
    title: "支付",
    text: "支持到店微信支付、支付宝和现金。不支持线上预付。会员储值在前台办理，充1000送100。",
  },
  {
    id: "caution",
    title: "注意事项",
    text: "饭后一小时内不宜做力度大的推拿。孕妇、严重高血压、皮肤破损或醉酒请先咨询前台，不要直接预约力度大的项目。酒后不做中式大力推拿。",
  },
  {
    id: "services",
    title: "项目说明",
    text: "中式推拿以穴位和肌肉为主。泰式拉伸活动关节。精油SPA力度轻，偏放松。足疗以足部和小腿为主。肩颈专项45分钟，针对久坐。运动恢复针对训练后的腰背酸痛。",
  },
];
