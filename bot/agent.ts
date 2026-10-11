import os from "node:os";
import path from "node:path";
import { defineAgent } from "@cursor/bdk";

export default defineAgent({
  name: "舒缓阁预约",
  description: "北京舒缓阁按摩房的预约、咨询和回访助手。",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  local: {
    cwd: path.join(os.homedir(), ".cache", "massage-booking"),
    sandbox: true,
  },
  hosting: {
    egressDomains: ["api.open-meteo.com", "geocoding-api.open-meteo.com"],
  },
});
