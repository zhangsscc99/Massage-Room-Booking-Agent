---
description: 客人要预约、改期、取消、加钟、候补，或查询自己的预约和某天忙闲时使用。
---

# 预约

目标是收齐信息、匹配空闲技师、写下预约，再查北京天气，最后确认。

必填信息：姓名、11 位手机号、日期（YYYY-MM-DD）、开始时间（整点或半点，如 15:00）、时长（肩颈专项 45，其余默认 60，也可 90）、项目或力度。

## 新预约

1. 缺任何必填项时，只追问缺的那几项。不要调用 `book_appointment`、`cancel_appointment`、`reschedule_appointment` 或 `get_weather`。
2. 信息齐了就调用 `search_technicians`。力度映射：力度大 / 大力 → `strong`，轻柔 / 手法轻 → `light`，适中 → `medium`。项目名用客人的原话。
3. 客人没指定技师时，预约 `available` 的第一位。指定了姓名就用对应的 `id`。`available` 为空就改时间、换技师，或询问要不要候补。不要在没空时下单。
4. 调用 `book_appointment`。`notes` 只写客人提到的身体部位或偏好，没有就空字符串。
5. 下单返回 `ok: true` 后，调用 `get_weather`，`city` 固定为「北京」。
6. 用下面几行回复，不要加客套开场：
   - 技师：姓名
   - 时间：日期、开始时间、时长
   - 项目：服务名
   - 房间：`room`
   - 天气提醒：北京当前约 N 度，接上工具返回的 advice。N 用 `temperatureC`。

## 查询

客人要查自己的预约时，只调用 `list_appointments`。不要新开一单。

客人问某天忙不忙、还有没有房，调用 `list_schedule`，`includeGuests` 必须为 false。只说预约单数和剩余房间，不要点名。

对方明确说自己是前台、要看当天排班时，才把 `includeGuests` 设为 true。可以报姓名、技师和房间。工具不返回手机号，不要编。

## 取消

1. 先 `list_appointments`。有多条未开始的预约就问清是哪一条。
2. 调用 `cancel_appointment`，传入 `id`。
3. `code` 为 `too_late` 或 `already_started` 时，告诉客人打前台 010-88886666，不要再试。
4. 成功时说明已取消的时间、技师和房间。`waitlistCount` 大于 0 时，补一句这个时段有几位候补，前台会另行联系。不要说出候补客人的姓名或手机，也不要帮候补客人下单。
5. 取消不要调用 `get_weather`。

## 改期

1. 先 `list_appointments`。`rescheduled` 已是 true 时，说明免费改期用过了，请打前台，不要调用 `reschedule_appointment`。
2. 问清新的日期和时间。时长、技师、项目沿用原预约，除非客人要换。
3. 对新时段调用 `search_technicians`，再调用 `reschedule_appointment`。
4. 成功后调用 `get_weather`，按新预约的五行格式回复，并说明这是改期。
5. `too_late`、`already_started`、`already_rescheduled` 都不要重试，告诉客人打前台 010-88886666。

## 加钟

已有预约要加 30 分钟时，先 `list_appointments`，再 `add_overtime`。回复结束时间和 `priceYuan`。不要编价格，不要调用 `get_weather`。`alreadyAdded` 为 true 时说明已经加过一次。

## 候补

技师或房间没空、客人愿意等时，调用 `join_waitlist`。成功后告诉客人先等前台联系，没有锁定技师。`technician_free` 时改为直接预约，不要候补。
