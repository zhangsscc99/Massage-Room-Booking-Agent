# 舒缓阁按摩房预约助手

对话式前台：判断来意、预约技师、回答店内问题，并按到店记录起草回访。

店里的技师、价目、历史预约和咨询都是假数据，写在 `bot/lib/parlor.ts` 和 `bot/lib/store.ts`。

## 角色

| 设计 | 落点 |
| --- | --- |
| 分类 | `bot/instructions.md`：无关就拒绝，预约、咨询、回访分去对应技能 |
| 预约 | `appointment` 技能。先 `search_technicians`，信息齐了才 `book_appointment` |
| 咨询 | `consultation` 技能。`search_knowledge` 检索店内资料，`record_consultation` 把问题记回账本 |
| 回访 | `follow-up` 技能，外加每天北京时间 10:00 的 `revisit` 日程 |
| 项目问答 | `project-learner` 技能。问架构、分块、RAG、延迟和评估时按代码里的事实回答 |
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

## 假数据里有谁

首次读取会写入这些客人。超过 14 天没来、没有即将到店的预约、并且 7 天内没发过问候，才需要回访。

- 张伟 `13800001111`：力强，肩颈，大约一个月没来，该回访。
- 王芳 `13700003333`：精油，大约一个半月没来，该回访。
- 周婷 `18644445555`：力强，腰痛，该回访。
- 陈静 `13766667777`：足疗，刚超过 14 天，该回访。
- 李娜 `13900002222`、刘洋 `13611112222`、吴磊 `15955556666`：最近来过。
- 赵敏 `13522223333`：肩颈，两天前已经发过问候。
- 孙浩 `15833334444`：运动恢复，几天后还有预约。
