# iOS App 同步开发设计与计划

日期：2026-06-29
状态：草案，待 brainstorming 确认

## 背景与目标

Healthy Body Manager 当前是一套 **Next.js 15（App Router）+ React 19 + Prisma(SQLite)** 的 Web 应用，业务逻辑已沉淀在 `app/api/**` 的 REST 路由和 `src/services/**` 的 service 层，UI（RSC + client component）只是消费者。

目标：**以 App Store 正式上架为导向，一步到位开发一个与网站同源数据的 iOS App**。核心策略是「后端复用 + 客户端重写」——把现有 Next.js 退化为同时服务 Web 和 App 的 API 后端，iOS 端用 React Native(Expo) 重新实现界面，复用既有 zod schema 做类型契约。

**为什么是这个方向**：

- 业务规则（规则引擎、Agent 动作层、COROS/菜单同步、计划生成）全在后端 service，重写客户端不碰这些，安全基线不动。
- 团队已吃透 React/TypeScript/zod，RN(Expo) 的心智成本远低于 SwiftUI，组件结构、类型、校验可大量复用。
- 产品有健康数据、后台同步、训练提醒推送等强原生诉求，且要正式上架，纯 PWA/套壳无法满足审核与体验要求，需要真正的原生壳。

## 关键设计决策

1. **后端定位**：现有 Next.js API 升级为「Web + App 双客户端后端」，业务 service 不动。
2. **客户端选型**：React Native + Expo（TypeScript），而非原生 SwiftUI。
3. **鉴权**：从纯 httpOnly cookie session 扩展为「Bearer access token + refresh token」，**向后兼容**现有 Web cookie。
4. **数据库**：从 SQLite 迁移到 Postgres。**真正的硬驱动是部署形态**——Next.js 要部署到 Vercel/serverless 或常驻服务器时，SQLite 文件库无法持久化/并发写，并非「多端并发」本身（本项目为单人使用，并发不是真问题）。Postgres 同时顺带解决多端写入与服务器部署。
5. **API 契约**：冻结一套 `/api/v1` 稳定接口 + 共享 zod 类型，供 RN 客户端生成 client。
6. **Agent 对话**：当前为一次性 JSON 请求/响应（非 SSE），客户端首期沿用请求/响应即可，流式作为后续增强。
7. **原生能力分期**：HealthKit、APNs 推送、后台同步作为 §7 独立阶段，不阻塞首个可用版本，但上架前需落地 HealthKit 以保证原生价值。
8. **发布路径**：TestFlight 内测 → App Store 正式上架。

## §1 总体架构

```
┌─────────────────────────┐      ┌──────────────────────────┐
│  Web 客户端 (现有)        │      │  iOS App (新, Expo/RN)    │
│  Next.js RSC + client    │      │  原生壳 + RN 业务层        │
└───────────┬─────────────┘      └────────────┬─────────────┘
            │ cookie session                  │ Bearer token
            └──────────────┬──────────────────┘
                           ▼
            ┌──────────────────────────────────┐
            │  Next.js API (/api/v1)            │
            │  withUser 鉴权中间件（cookie+token）│
            ├──────────────────────────────────┤
            │  src/services/** 业务层（不动）     │
            │  规则引擎 / Agent 动作层 / 同步      │
            ├──────────────────────────────────┤
            │  Prisma → Postgres                │
            └──────────────────────────────────┘
```

**边界约束**：

- iOS 端**永不**直连数据库，只走 `/api/v1`，所有写入仍经 `withUser → service`，安全上限只在后端生效。
- Web 与 App 共享同一份后端与 DB，数据天然同步。
- 共享代码仅限「无运行时副作用的类型/校验」（zod schema、领域类型），不共享 React 组件。

## §2 鉴权改造（最关键、首期阻塞项）

现状 `src/auth/session.ts`：登录写 `hbm_session` httpOnly cookie，`getCurrentUser()` 读 cookie 查 `Session` 表（token 已是 SHA256 hash 存储）。原生 App 用 cookie 体验差，需引入 token。

**改造方案（兼容式）**：

1. **登录端点增强**（`app/api/auth/login/route.ts`）：除了写 cookie，额外在响应体返回 `{ accessToken, refreshToken, expiresAt }`。Web 端忽略 body 里的 token 继续用 cookie；App 端忽略 cookie，把 token 存进 **iOS Keychain（expo-secure-store）**。
2. **复用现有 `Session` 表**：`refreshToken` 沿用现有 session 机制（hash 存储、30 天有效）。`accessToken` 为短期（如 15 分钟），可用无状态 JWT 或同样落 `Session` 表（首期建议落表，最简单，复用 `hashToken`）。
3. **`getCurrentUser()` 双通道**：先读 `Authorization: Bearer <token>` header，命中则按 token 查；否则回退读 cookie。`withUser`（`src/auth/api.ts`）零改动即可同时支持两端。
4. **刷新端点**：新增 `POST /api/v1/auth/refresh`，用 refreshToken 换新 accessToken。**推荐启用 refresh token rotation**：每次刷新同时发新 refreshToken 并失效旧的，降低长效 token 被盗后的风险（30 天长效 token 存设备上风险较高）。
5. **登出**：`logout` 支持按 token 失效。
6. **限流**：`/api/auth/login` 与 `/api/auth/refresh` 暴露给 App 后即公开攻击面，需加 IP/账号维度的限流（可简易中间件或 Upstash/部署平台限流）。

**注意**：此项是 App 能登录的前提，必须在客户端开发前完成。改动集中在 `src/auth/session.ts`、`src/auth/api.ts`、`app/api/auth/*`，不影响 Web 行为。

## §3 数据库与部署

- **迁移 Postgres**：`prisma/schema.prisma` 的 `datasource db.provider` 由 `sqlite` 改为 `postgresql`，重跑 migration。schema 本身基本兼容（注意 SQLite 的隐式行为差异，如大小写、布尔、JSON 字段）。
- **部署形态**：Next.js 同时承载 Web 页面与 API。可先单体部署（Vercel/自建），API 与页面同源；后续如需可把 API 拆为独立服务。
- **环境隔离**：dev / staging / prod 三套 DB，App 内置可切换的 API base URL（便于 TestFlight 指向 staging）。

## §4 API 契约与类型共享

现有 23 个 route 已覆盖：auth、profile、goals、plan/generate、training/tasks、calendar/drafts、sync(coros/calendar)、settings/mcp、agent(对话/记忆/调整)。

1. **版本化**：新增 `/api/v1` 前缀（可用 route group 或薄转发层指向现有 handler），冻结契约，避免改 Web 时打断 App。
2. **类型契约**：把请求/响应 schema 用 zod 显式定义（项目已用 zod，`src/domain/validation.ts` 已有基础），客户端 import 同一份 zod 做运行时校验 + 类型推导。
3. **统一错误格式**：约定 `{ error: string, code?: string }`，App 端统一拦截 401 触发刷新/重登。
4. **分页/增量**：列表型数据（activity/sleep/recovery records）**注意这些表只有 `createdAt`，没有 `updatedAt`**（见 `prisma/schema.prisma`）。增量拉取应基于 `startedAt`（activity）/ `date`（sleep/recovery）或 `createdAt`，约定 `?since=<ISO>` 增量过滤，支撑客户端缓存与离线。

## §5 客户端架构（Expo / React Native）

- **脚手架**：Expo（managed workflow）+ TypeScript + expo-router（文件路由，心智接近 Next App Router）。
- **导航结构**：底部 Tab —— `今日`(Today)、`计划`(Plan)、`数据`(Insights)、`教练`(Agent)、`我的`(Settings)。
- **状态/数据**：TanStack Query（请求缓存 + 后台刷新 + 乐观更新），API client 用 fetch 封装注入 Bearer + 自动刷新。
- **类型校验**：响应过 zod parse，与后端共享 schema。
- **设计系统**：建一套与 Web 视觉一致的轻量组件库（Token：颜色/间距/字号），不照搬 Web 组件。
- **安全存储**：token 存 expo-secure-store（Keychain）。

## §6 核心功能模块移植（按优先级）

| 优先级 | 模块 | 对应 API | 说明 |
|---|---|---|---|
| P0 | 登录/会话 | `/api/v1/auth/*` | Bearer 流程跑通 |
| P0 | 今日训练 | `training/tasks/[id]/completion`, plan | 当天任务 + 打卡 |
| P0 | 周计划 | `plan/generate`, tasks | 查看/生成周计划 |
| P1 | 数据看板 | activity/sleep/recovery（经 plan/context 暴露） | 趋势图表 |
| P1 | 教练对话(Agent) | `agent`, `agent/conversations/*` | 见 §8 |
| P1 | 目标管理 | `goals/*` | 增删改查 |
| P2 | 设置/模型/MCP | `settings/*`, `settings/mcp/*` | OAuth 回调在 App 内用 ASWebAuthenticationSession/外部浏览器处理 |
| P2 | 日历草稿确认 | `calendar/drafts/*` | 与 Agent 高风险确认联动 |

**说明**：部分数据目前仅通过 RSC 页面渲染、未必有独立纯数据 API（如看板聚合）。移植时需为这些视图补 GET 数据端点（归入 §4 契约整理）。

## §7 原生能力增强（独立阶段，上架前需落地 HealthKit）

1. **HealthKit**：读取 iPhone/Apple Watch 的活动、睡眠、心率，作为 `ActivityRecord/SleepRecord/RecoveryRecord` 的新 `source="healthkit"`，与 COROS 并存。**同时也是上架的「实质原生价值」证据**，规避纯套壳拒审风险。
2. **推送(APNs)**：训练提醒、计划生成完成、Agent 高风险待确认通知。用 Expo Push + 服务端 token 表。
3. **后台同步**：BackgroundTasks 定时拉增量 + 触发 COROS/菜单同步。
4. **Deep Link**：推送点击直达对应任务/对话。

## §8 Agent 对话端适配

- 现状 `POST /api/agent` 是**一次性 JSON**（非 SSE）：返回 `message`、`adjustments`、`appliedMemories`。客户端首期直接请求/响应即可，无需流式。
- App 端 Agent 页复刻 `AgentPanel` 行为：消息列表、低风险动作执行结果摘要、高风险提案确认卡（调 `agent/proposals/[id]/confirm` 或现有 adjustments/undo）。
- **流式增强（后续）**：若后端改 SSE，RN 用 `expo/fetch` 流式读取或 EventSource polyfill。
- Agent 执行写入后，App 端用 TanStack Query 失效相关查询触发刷新（等价 Web 的 `router.refresh()`）。

## §9 离线与同步策略

- **读**：TanStack Query 持久化缓存（AsyncStorage），离线展示上次数据。
- **增量**：基于 `startedAt`/`date`/`createdAt`（这些表无 `updatedAt`）+ `?since=` 拉增量。
- **写**：打卡等写操作支持乐观更新 + 失败回滚；离线写入排队，恢复网络后重放（首期可只做「在线才允许写」，离线写入排队作为后续增强）。

## §10 测试与发布

- **后端**：现有 vitest 体系覆盖鉴权改造（token 双通道单测）、契约层。
- **客户端**：组件/hook 用 RN Testing Library；关键流程（登录/打卡/对话）E2E 用 Maestro 或 Detox。
- **发布**：Apple Developer 账号（$99/年）→ EAS Build 打包 → TestFlight 内测 → App Store 提审。
  - **审核要点**：App 必须有实质原生价值（HealthKit/推送），避免被判「纯套壳」拒审 → 故 §7 的 HealthKit 必须在提审前落地。
  - 需准备隐私政策、健康数据使用说明（HealthKit 用途描述）、App 隐私清单（PrivacyInfo）。

## 分阶段计划（Plan）

| 阶段 | 里程碑 | 关键交付 | 依赖 | 粗估 |
|---|---|---|---|---|
| **M0 后端就绪** | API 可被原生端安全消费 | §2 Bearer 鉴权（兼容 cookie）、§3 Postgres 迁移、§4 `/api/v1` + zod 契约 | 无 | 1–1.5 周 |
| **M1 客户端骨架** | 能登录并拉到真实数据 | §5 Expo 脚手架、导航、API client(自动刷新)、Keychain、设计 token | M0 | 1 周 |
| **M2 核心功能** | 日常可用闭环 | §6 P0：今日训练 + 打卡 + 周计划 | M1 | 1.5–2 周 |
| **M3 完整功能** | 功能对齐 Web 主路径 | §6 P1：数据看板、Agent 对话、目标 | M2 | 2 周 |
| **M4 原生增强** | 差异化体验 + 满足审核 | §7：HealthKit、推送、后台同步、Deep Link | M3 | 2 周 |
| **M5 打磨上架** | App Store 上线 | §6 P2（设置/MCP）、§10：E2E、隐私材料、TestFlight、提审 | M4 | 1.5–2 周 |

总粗估约 **8.5–10.5 周**（单人全职口径，含缓冲）。M0 是硬阻塞，必须先做；M4 的 HealthKit 是上架前置条件；M5 含审核往返缓冲。

## 范围与非目标

**本次范围内**：

- 后端 Bearer 鉴权改造（兼容 Web cookie）
- Postgres 迁移与部署形态调整
- `/api/v1` 契约冻结 + zod 类型共享
- Expo/RN 客户端：核心功能（今日/计划/看板/Agent/目标/设置）
- HealthKit、APNs 推送、后台同步
- TestFlight + App Store 正式上架

**本次非目标（明确排除）**：

- 不重写任何后端业务 service / 规则引擎 / Agent 动作层
- 不做 Android（RN 后续可低成本扩展，但本次只交付 iOS）
- 不做 Agent SSE 流式（首期沿用请求/响应，流式留作增强）
- 不做完整离线写入队列（首期在线写入，离线写排队留作增强）
- 不替换现有 Web 前端（Web 与 App 并存）

## 风险与开放问题

1. **MCP / OAuth 在原生端的回调**（COROS、飞书日历）：当前 `settings/mcp/oauth/callback` 为 Web 重定向流程，App 内需用 ASWebAuthenticationSession 或外部浏览器 + Deep Link 回跳，需单独验证。
2. **Postgres 迁移的 SQLite 行为差异**：JSON 存储字段（`*Json`）、唯一约束、大小写敏感性需回归测试。
3. **看板类数据缺独立 API**：部分聚合目前只在 RSC 内计算，需补 GET 端点，工作量待 §4 细化时确认。
4. **App Store 审核**：必须确保原生价值（HealthKit/推送）到位，否则有套壳拒审风险——HealthKit 在 M4 落地后再提审；另需备齐隐私政策与健康数据用途说明。
5. **Apple Developer 账号**：需提前注册 $99/年账号并完成实名/组织认证，避免卡在提审环节。
