// 全套假数据。演示用，不是真实门店。

export const PARLOR = "舒缓阁";
export const CITY = "北京";
export const FRONT_DESK = "010-88886666";
export const OPEN_MIN = 10 * 60;
export const CLOSE_MIN = 22 * 60;

export type Force = "light" | "medium" | "strong";
export type Gender = "male" | "female";
export type Minutes = 45 | 60 | 90;

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
    blurb: "力度偏大，熟客多约他处理肩颈和腰背。",
  },
  {
    id: "xiaorou",
    name: "晓柔",
    gender: "female",
    force: "light",
    years: 6,
    specialties: ["轻柔", "精油SPA", "放松"],
    services: ["精油SPA"],
    blurb: "手法轻，只做精油放松，不接大力推拿。",
  },
  {
    id: "atai",
    name: "阿泰",
    gender: "male",
    force: "medium",
    years: 8,
    specialties: ["泰式拉伸", "关节"],
    services: ["泰式拉伸"],
    blurb: "泰式拉伸，力度适中，适合想活动开的客人。",
  },
  {
    id: "zhou",
    name: "周师傅",
    gender: "male",
    force: "strong",
    years: 15,
    specialties: ["足疗", "中式推拿"],
    services: ["足疗", "中式推拿"],
    blurb: "店里足疗最久，也能做力度大的中式推拿。",
  },
  {
    id: "xiaoya",
    name: "小雅",
    gender: "female",
    force: "medium",
    years: 5,
    specialties: ["肩颈", "手法适中"],
    services: ["肩颈专项"],
    blurb: "肩颈专项，力度适中，常接久坐的客人。",
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
  {
    id: "linjie",
    name: "林姐",
    gender: "female",
    force: "light",
    years: 9,
    specialties: ["精油SPA", "轻柔", "失眠"],
    services: ["精油SPA"],
    blurb: "精油和放松，力度轻，晚上的钟点较多。",
  },
  {
    id: "laohan",
    name: "老韩",
    gender: "male",
    force: "medium",
    years: 18,
    specialties: ["足疗", "中式推拿", "手法适中"],
    services: ["足疗", "中式推拿"],
    blurb: "从业最久，足疗和中式都做，力度适中。",
  },
];

export function technicianById(id: string): Technician | undefined {
  return technicians.find((item) => item.id === id);
}

export type Service = {
  name: string;
  summary: string;
  options: Array<{ minutes: Minutes; price: number }>;
};

export const services: Service[] = [
  {
    name: "中式推拿",
    summary: "以穴位和肌肉为主，可按肩颈或腰背。",
    options: [
      { minutes: 60, price: 298 },
      { minutes: 90, price: 398 },
    ],
  },
  {
    name: "泰式拉伸",
    summary: "活动关节，力度适中。",
    options: [
      { minutes: 60, price: 358 },
      { minutes: 90, price: 468 },
    ],
  },
  {
    name: "精油SPA",
    summary: "力度轻，偏放松。",
    options: [
      { minutes: 60, price: 328 },
      { minutes: 90, price: 438 },
    ],
  },
  {
    name: "足疗",
    summary: "足部和小腿为主。",
    options: [
      { minutes: 60, price: 198 },
      { minutes: 90, price: 268 },
    ],
  },
  {
    name: "肩颈专项",
    summary: "45 分钟，针对久坐肩颈。",
    options: [{ minutes: 45, price: 168 }],
  },
  {
    name: "运动恢复",
    summary: "训练后的腰背酸痛。",
    options: [{ minutes: 60, price: 368 }],
  },
];

export function canonicalService(input: string): string {
  const trimmed = input.trim();
  const hit = services.find((item) => trimmed.includes(item.name));
  return hit === undefined ? trimmed : hit.name;
}

export type KnowledgeDoc = {
  id: string;
  title: string;
  text: string;
};

function priceText(): string {
  const lines = services.map((item) => {
    const bits = item.options.map((option) => `${option.minutes}分钟${option.price}`);
    return `${item.name}：${bits.join("，")}`;
  });
  return `舒缓阁价目，到店支付，单位元。${lines.join("。")}。会员充1000送100，充500送30。价格含基础茶水，不含加钟。`;
}

function serviceText(): string {
  return services.map((item) => `${item.name}：${item.summary}`).join("");
}

export const knowledge: KnowledgeDoc[] = [
  {
    id: "store",
    title: "门店与营业",
    text: "舒缓阁在北京市朝阳区工体北路88号2层。营业时间每天10:00到22:00，项目必须在22:00前结束。地铁10号线团结湖站B口步行8分钟。前台电话010-88886666。门店所在城市是北京。",
  },
  {
    id: "prices",
    title: "价目",
    text: priceText(),
  },
  {
    id: "policy",
    title: "预约与取消",
    text: "预约需要姓名、11位手机号、日期、开始时间（整点或半点）、时长和项目或力度偏好。时长只有45、60、90分钟。可提前2小时免费改期一次。迟到超过15分钟，按剩余时间服务。取消需提前2小时，否则记一次爽约。对话里不能直接取消或改掉旧预约，请联系前台010-88886666。",
  },
  {
    id: "payment",
    title: "支付与会员",
    text: "支持到店微信支付、支付宝和现金。不支持线上预付。会员在前台办理：充1000送100，充500送30。积分只能到店核销，不能折现。",
  },
  {
    id: "caution",
    title: "注意事项",
    text: "饭后一小时内不宜做力度大的推拿。孕妇、严重高血压、皮肤破损或醉酒请先咨询前台，不要直接预约力度大的项目。酒后不做中式大力推拿。未满16周岁不接待。",
  },
  {
    id: "services",
    title: "项目说明",
    text: serviceText(),
  },
  {
    id: "overtime",
    title: "加钟",
    text: "加钟按30分钟计，且必须在22:00前结束。中式推拿80元，泰式拉伸100元，精油SPA90元，足疗60元，肩颈专项60元，运动恢复90元。加钟在房间里向前台补，不在预约时预收。",
  },
  {
    id: "parking",
    title: "停车",
    text: "开车可停工体北路对面的地面停车场。当日消费满298元，可在前台领2小时停车券。地铁来的客人从团结湖站B口步行8分钟。",
  },
  {
    id: "room",
    title: "房间",
    text: "店内有8间单人房、2间双人房。双人项目要两名技师同一时段都空闲，预约时请说明要双人。房间不指定楼层，到店由前台安排。",
  },
  {
    id: "dress",
    title: "着装与用品",
    text: "店内提供一次性短裤、拖鞋和毛巾，不用自带。精油项目另外提供浴衣。贵重物品不要留在房间，可放前台寄物柜。",
  },
  {
    id: "invoice",
    title: "发票",
    text: "可开电子普通发票。抬头和税号到店告诉前台，或加前台微信010-88886666对应的企业微信发送。不开增值税专用发票。",
  },
];
