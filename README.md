# 舒缓阁按摩房预约助手

对话式前台：判断来意、预约技师、回答店内问题，并按到店记录起草回访。

这是一套可替换的示例门店（北京朝阳「舒缓阁」）。真实技师、价目和文案都在 `bot/lib/parlor.ts`。

## 角色

| 设计 | 落点 |
| --- | --- |
| 分类 | `bot/instructions.md`：无关就拒绝，预约、咨询、回访分去对应技能 |
| 预约 | `appointment` 技能。先 `search_technicians`，信息齐了才 `book_appointment` |
| 咨询 | `consultation` 技能。`search_knowledge` 做店内资料检索，回答只引用原文 |
| 回访 | `follow-up` 技能，外加每天北京时间 10:00 的 `revisit` 日程 |
| 天气 | 预约成功后调用 `get_weather`（Open-Meteo，城市北京） |
| 记忆 | `bot/hooks/memory.ts` 记录每轮对话；预约和回访存在宿主 KV |

当前没有接远程天气 MCP。BDK 不允许给内联 MCP 工具打开按名暴露，所以天气做成服务端工具，由模型在下单后调用。

## 本地运行

```bash
npm install
npm run check
npx bdk validate --dir .
npm run dev
```

打开 <http://127.0.0.1:3000/playground>。模型回合需要 Cursor 凭证（`CURSOR_API_KEY` 或 `npx bdk login`）。

直接调用工具不需要模型：

```bash
npx bdk call search_knowledge --dir . --input '{"query":"中式推拿 60 分钟多少钱"}'
npx bdk call review_guests --dir . --input '{}'
```

## 示例客人

首次读取会写入三位历史客人：张伟（约 30 天前，肩颈，力度大）、李娜（约 3 天前）、王芳（约 45 天前，精油）。回访默认超过 14 天未到店才需要联系。
