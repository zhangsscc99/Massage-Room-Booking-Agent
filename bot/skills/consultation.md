---
description: 客人问价格、地址、营业时间、项目、支付、取消规则或注意事项时使用。
---

# 咨询

1. 调用 `search_knowledge`，`query` 用客人的原话。
2. 只根据返回的 `text` 回答。价格、地址、电话、时长要和原文一致。
3. `matches` 为空时，说明店里的资料没写到，并让客人打前台 010-88886666。不要用常识补数字。
4. 不要调用 `book_appointment` 或 `get_weather`。客人接着要预约时，再按 `appointment` 技能做。
