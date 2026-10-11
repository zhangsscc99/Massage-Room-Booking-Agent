import { prompt } from "@cursor/bdk";
import { defineTool } from "@cursor/bdk/tools";
import { z } from "zod";
import { lookupWeather } from "../lib/weather.js";

export default defineTool({
  description: prompt`
    查询城市当前天气。舒缓阁在北京，预约确认时 city 传北京。
    把 temperatureC 和 advice 写进确认的天气提醒，不要自己编温度。
  `,
  effect: "read",
  inputSchema: z.object({
    city: z.string().min(1).describe("城市名。门店固定传北京"),
  }),
  async execute({ city }) {
    return lookupWeather(city);
  },
});
