# PersonalHealthyManager 产品说明

> 版本：v0.1（首版原型） · 更新日期：2026-07-12 · 语言：中文

## 一、产品定位

**PersonalHealthyManager（健康体管家）** 是一款面向个人耐力运动爱好者（跑步、骑行、铁三等）的"训练 - 恢复 - 日程 - 营养"一体化私人教练原型。它把可穿戴设备的活动/睡眠/恢复数据、日历空闲时段、个人身体档案与目标，喂给一套**确定性的规则规划引擎**，自动产出保守安全的每周训练计划、每日打卡清单、营养建议和日历草稿，并配有一个可对话、可执行动作、可撤销的 AI Agent 作为交互外壳。

一句话：**用规则引擎保证安全底线，用 AI Agent 提供自然语言交互，把"今天该练什么、能不能练、什么时间练、怎么吃"一次性回答清楚。**

## 二、目标用户

- 有 COROS / 类似可穿戴设备的耐力运动爱好者（跑者、骑行者、铁人三项选手）
- 同时使用飞书日历管理时间、希望在空闲时段自动安排训练的白领
- 有短期赛事目标（马拉松、骑行赛）并需要倒推备战周期的人
- 受过伤、需要保守递进、不希望被"激进 AI 计划"带伤的人

## 三、解决的核心问题

| 痛点 | 本产品的解法 |
|---|---|
| 训练计划与今日身体状态脱节 | 引擎每次生成前先读最近一次睡眠(<360min)、恢复值(<50%)、伤病标记，命中任一即自动降级为 recovery 强度 |
| 计划排不进真实日程 | 引入飞书日历快照，按"空闲窗口"把训练塞进真正可用的时间段，并产出日历草稿待确认 |
| AI 计划不可控、会偷偷改日历 | 日历写入是"确认优先"（confirmation-first），草稿状态需用户显式确认；外部事件 ID 复用避免重复建会 |
| 训练完不成后整周计划作废 | 打卡反馈（完成/跳过/调整强度）会**保守地重排剩余周计划**，并同步更新对应日历草稿 |
| 多个 App 切来切去 | 一个 App 内闭环：数据同步 → 计划生成 → 打卡 → 营养 → 日历 → 对话复盘 |

## 四、核心功能模块

### 1. 账户与身体档案（Profile）
- 邮箱/密码登录，所有数据按用户隔离
- 身体档案：身高、体重、体脂、生日、性别、静息心率、训练经验（beginner/intermediate/advanced）、伤病列表、饮食/训练偏好
- 经验等级直接决定周训练量上限（120 / 180 / 240 分钟），并结合近期实际跑量做 0.75× 经验上限的兜底

### 2. 目标管理（Goals）
- 支持主目标（primary）与短期赛事目标（short_term_event）
- 短期赛事目标会按距离赛事日的天数**动态加权**：≤14 天 +4、≤42 天 +3、≤84 天 +2，自动浮为本周主目标
- 目标关联到具体训练任务，可追溯

### 3. 数据同步（Sync）
- `POST /api/sync/coros`：消费 COROS 风格的活动、睡眠、恢复 payload
- `POST /api/sync/calendar`：消费飞书日历风格的日程快照
- 提供"Sync demo data"一键灌入本地样例数据
- 所有外部字段在 `src/providers` 内被规范化为内部模型，规划引擎只吃内部模型，**与外部数据源解耦**

### 4. 规划引擎（Planning Engine）— 产品的安全心脏
位于 `src/planning/engine.ts`，纯函数、可测试、确定性：

- **安全门控**：睡眠 <6h 或质量 <55 → 降级；恢复 <50% → 降级；有伤病 → 降级
- **目标选择**：按"有效优先级"选本周主目标，识别 marathon/马拉松、cycling/骑行 等关键词调整训练类型与时长（马拉松长距离 75min）
- **周计划骨架**：3 次训练 = 1 次主项 + 1 次力量/稳定性 + 1 次长有氧，强度统一受安全门控约束
- **容量封顶**：按经验上限和近期实际量取最小值，超量时按比例缩减但保留最低时长（恢复 20min / 其他 25min）
- **日历适配**：把训练塞进 ≥ 时长的空闲窗口，落出 `scheduledStart/End`
- **营养联动**：根据本周强度和主目标给出菜单推荐目标

### 5. 训练打卡与计划自适应（Training Checklist）
- 每个训练任务带顺序打卡清单（热身 → 主项 → 冷身 → 拉伸 → 记录 RPE）
- 完成时可关联 COROS 活动记录，记录"计划 vs 实际"对比
- "Update training" 触发剩余周计划的保守重排
- 任一未来任务被改时间/强度，对应的日历草稿同步更新；已确认事件回退为草稿，复用同一 externalEventId，**不会重复建会**

### 6. 日历草稿与确认（Calendar Drafts）
- 计划生成即产出日历草稿（operation=upsert）
- 重新生成本周会**取代**旧计划与其草稿，仅保留最新一份可执行提案
- 旧事件 ID 透传到新草稿；不再适配的事件产出 cancellation 草稿
- 确认后记录 mock 飞书 externalEventId，未来可无缝替换为真实飞书 MCP 写入

### 7. 营养与菜单（Nutrition）
- 按训练强度与主目标计算营养目标
- 每日菜单推荐（早/午/晚），MVP 阶段为 mock 数据，已预留接入 Nutritionix / Edamam / FoodData Central 的位置（见 `docs/public-apis.md`）

### 8. AI Agent — 产品的交互外壳
- 持久化对话（`AgentConversation` / `AgentMessage`），跨会话记忆（`AgentMemory`，带 kind/category/confidence/status）
- 意图识别：恢复检查 / 日历确认 / 菜单建议 / 重新规划 / 训练分析 / 通用
- **可执行动作注册表**（`src/services/agentActions/registry.ts`），按可逆性分三类：
  - `readonly`：explain_plan、recommend_menu
  - `reversible`：adjust_task_intensity、reschedule_task、skip_task、regenerate_plan（可 undo）
  - `external_irreversible`：confirm_calendar_draft（写到外部日历，不可撤销）
- **Safety Guard**：动作执行前做安全校验，外部不可逆动作需额外确认
- **快照 + 撤销**：每个 reversible 动作落地前先存 `PlanAdjustment` 快照，可回滚
- 模型可配置（`UserSettings`：provider、model、baseUrl、加密 API Key），未配置时退化到规则响应

### 9. 洞察（Insights）
- `GET /api/v1/insights/activities|recovery|sleep`：分别给出活动、恢复、睡眠的可视化数据
- `GET /api/v1/today`：今日一屏聚合（今日任务、恢复状态、菜单、日程）

## 五、双端形态

### Web 端（Next.js 15 + React 19）
- App Router：`(auth)` 登录、`(dashboard)` 下含 profile / goals / plan / agent / settings
- API：`/api/v1/*` 给前端和移动端共用，`/api/sync/*` 给外部 Agent/MCP 调用
- 双 Token：refresh（长期，Web cookie）+ access（短期 Bearer，父子级联失效）

### 移动端（Expo + React Native + expo-router，M1 骨架已就位）
- 5 个 Tab：**今日 / 计划 / 数据 / 教练 / 我的**
- API Client：自动注入 Bearer、401 单飞刷新、zod 校验、统一错误映射
- SecureStore 存 token，AuthProvider + 路由守卫
- "今日" Tab 已接 `GET /api/v1/profile` 作为真实数据探针
- 设计 token 底座对齐 Web 端 light/dark 主题

## 六、技术架构

```
外部 Agent / MCP 工作流
  → COROS 与飞书 payload
  → /api/sync/* 导入端点
  → src/providers 规范化（隔离外部字段）
  → 用户级 Prisma 记录（SQLite，可换 Postgres）
  → src/planning/engine 确定性规划引擎
  → 计划 / 打卡项 / 营养目标 / 日历草稿
  → Web App + iOS App + Agent 解释
```

- **Monorepo**：npm workspaces，`apps/mobile` + `packages/contracts`
- **后端**：Next.js Route Handlers + Prisma 6 + Zod 校验
- **数据库**：SQLite（本地），13 张核心表覆盖用户、会话、档案、目标、活动/睡眠/恢复、日历快照、计划、训练任务、打卡、完成、调整、草稿、Agent 对话/消息/记忆、设置、推送 token
- **测试**：Vitest + Testing Library，`npm test` + `npm run build` 双闸门

## 七、安全与隐私设计

- 所有数据按 `userId` 隔离，复合唯一约束（`@@unique([id, userId])`）防越权
- API Key 在服务端加密存储（IV + Tag + Hint）
- 日历写入确认优先，外部不可逆动作单独标记
- Agent 动作分三级可逆性，reversible 动作全量留快照可撤销
- token 父子级联：refresh 失效，其下所有 access 一并失效

## 八、扩展路线（按文档已规划）

- **M2**：今日/计划/打卡 Tab 实装
- **M3**：看板 / Agent / 目标 Tab 实装
- **M4/M5**：HealthKit、推送、后台同步、深链、MCP OAuth、EAS Build + TestFlight
- **数据源扩展**：Strava / Fitbit（OAuth）、Nutritionix / Edamam（饮食）、Wger（动作库）、Infermedica（症状自测，可选）
- **真实飞书写入**：把当前 mock externalEventId 替换为飞书 MCP 写入，UI 与计划工作流不变

## 九、试用方式

```bash
npm install && cp .env.example .env
npm run prisma:generate && npx prisma migrate deploy
npm run seed && npm run dev
```

登录 `demo@example.com` / `healthy-body-demo`，依次：Profile 同步 demo 数据 → Goals 加目标 → Plan 生成本周 → 打卡并 Update training → 确认日历草稿 → 用 Agent 对话做恢复/菜单/重排。

## 十、相关文档

- [README.md](../README.md) — 开发者快速上手
- [docs/public-apis.md](./public-apis.md) — 健康管理相关公开 API 接入清单
- `apps/mobile/README.md` — iOS 客户端骨架说明
- `prisma/schema.prisma` — 数据模型权威定义
