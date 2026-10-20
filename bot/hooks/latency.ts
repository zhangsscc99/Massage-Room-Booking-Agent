import { defineHook } from "@cursor/bdk/hooks";

const receivedAt = new Map<string, number>();
const firstOutputMs = new Map<string, number>();

function keyOf(event: { sessionId: string; turnId?: string }): string {
  return event.turnId ?? event.sessionId;
}

export default defineHook({
  events: {
    "message.received"(event) {
      receivedAt.set(keyOf(event), Date.parse(event.at));
    },
    "message.appended"(event) {
      const key = keyOf(event);
      if (firstOutputMs.has(key)) return;
      const started = receivedAt.get(key);
      if (started === undefined || Number.isNaN(started)) return;
      firstOutputMs.set(key, Date.parse(event.at) - started);
    },
    async "turn.completed"(event, ctx) {
      const key = keyOf(event);
      const started = receivedAt.get(key);
      const turnMs = started === undefined || Number.isNaN(started) ? null : Date.parse(event.at) - started;
      const toFirstOutputMs = firstOutputMs.get(key) ?? null;
      receivedAt.delete(key);
      firstOutputMs.delete(key);
      await ctx.host.kv.put("latency:last", {
        sessionId: ctx.session.id,
        turnId: event.turnId ?? null,
        toFirstOutputMs,
        turnMs,
        at: event.at,
      });
    },
  },
});
