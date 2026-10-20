# massage-booking

Bot Development Kit (BDK) project (`@cursor/bdk`). This file is for coding agents editing the project. The served agent's prompt is `bot/instructions.md`.

## Loop

```bash
npx bdk validate --dir .
npx bdk info --dir . --json
npx bdk call search_technicians --dir . --input '{"query":"力度大的中式推拿","date":"2026-11-28","time":"15:00","durationMinutes":60,"force":"strong"}'
npx bdk run --dir . --message "中式推拿 60 分钟多少钱？"
npx bdk eval --dir .
npm run check
```

Run the CLI under Node, never Bun. `npm run dev` serves this agent in single mode.

## Layout

- `bot/instructions.md` classifies each turn. Procedures live in `bot/skills/`.
- `bot/lib/parlor.ts` is the sample catalog: technicians, prices, and shop copy. Replace it when real shop data arrives.
- `bot/lib/store.ts` keeps appointments, cancellations, waitlist, and members in `ctx.host.kv`.
- `bot/lib/desk.ts` owns cancel, reschedule, overtime, rooms, quotes, and recharge rules. `scripts/check-desk.ts` locks those rules.
- `bot/tools/<name>.ts` is one tool. The filename is the tool name.
- `evals/` holds filesystem evals. Not `bot/evals/`.

## Do not

- Grow host TypeScript for reply wording. Host code owns validation, slot conflicts, retrieval, and weather lookup.
- Add npm dependencies beyond `@cursor/bdk` and `zod`.
- Point `serve` at a parent folder. It mounts every sibling.
