# iOS App · M0 后端就绪 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M0 阶段）

## 这份清单的范围

只覆盖 M0：**让现有 Next.js 后端能被原生 App 安全消费**，不写任何客户端代码。三件事：

1. Bearer token 鉴权（兼容现有 Web cookie）
2. SQLite → Postgres 迁移
3. `/api/v1` 契约冻结 + zod 类型共享

执行顺序：**T2 数据库 → T1 鉴权 → T3 契约**（鉴权要加表，先把 DB 形态定下来更顺；但 T1/T3 schema 设计可并行先想）。每个任务结尾给出验收标准。

---

## T1 Bearer Token 鉴权（兼容 cookie）

### 现状

- `src/auth/session.ts`：`createSession(userId)` 生成随机 token → SHA256 hash 存 `Session` 表 → 写 `hbm_session` httpOnly cookie。`getCurrentUser()` 只读 cookie。
- `src/auth/api.ts`：`withUser()` 调 `getCurrentUser()`，401 拦截。
- `app/api/auth/login/route.ts`：验密码 → `createSession` → 返回 `{ ok: true }`（不返回 token）。
- `app/api/auth/logout/route.ts`：`destroySession()`。
- `Session` 表（schema）：`id / tokenHash@unique / userId / expiresAt / createdAt`。

### 设计

引入「双 token」，**复用现有 `Session` 表机制**，最小改动：

- **refreshToken**：长期（沿用现有 30 天），等价现在的 session token。
- **accessToken**：短期（15 分钟），同样 hash 落 `Session` 表，用 `kind` 字段区分。

#### 步骤

1. **扩展 `Session` 模型**（`prisma/schema.prisma`）：
   - 加 `kind String @default("refresh")`（取值 `access` / `refresh`）。
   - 加 `parentId String?`（access token 关联其 refresh token，便于级联失效）。
   - 生成 migration（见 T2，统一在 Postgres 上跑）。
   - **存量影响说明**：加字段后存量 Web session 行自动成为 `kind="refresh"`——它们本就是当前 Web cookie 用的长效 token，行为不变（Web 不走 refresh 流），在 migration 注记里写明，避免后人疑惑。

2. **重构 `src/auth/session.ts`**：
   - 抽出底层 `createToken(userId, kind, ttlMs, parentId?)` → 返回明文 token + 落 hash。
   - `issueTokenPair(userId)`：建一个 refresh + 一个 access，返回 `{ accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }`。
   - 保留 `createSession(userId)`（写 cookie 用），内部改为基于 refresh token 写 cookie，行为对 Web 不变。
   - 新增 `getUserByBearer(token)`：hash 查 `Session` where `kind="access"`，校验未过期。
   - `getCurrentUser()` 改为**双通道**：先看请求头 `Authorization: Bearer`（命中走 `getUserByBearer`），否则回退现有 cookie 逻辑。
     - 注意：`getCurrentUser` 现在通过 `next/headers` 的 `cookies()` 读 cookie；Bearer 需读 `headers()`，两者都是 server 端可用 API。

3. **登录端点**（`app/api/auth/login/route.ts`）：
   - 验密码成功后，仍调 `createSession`（Web cookie 不变），**额外**调 `issueTokenPair`，响应体返回 `{ ok: true, accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }`。
   - Web 端忽略 body 里的 token；App 端忽略 cookie 用 token。

4. **新增刷新端点** `app/api/auth/refresh/route.ts`：
   - `POST { refreshToken }` → 校验 refresh 有效 → 旧 access 失效（按 parentId 删）→ 发新 access → 返回 `{ accessToken, accessExpiresAt }`。

5. **登出端点**（`app/api/auth/logout/route.ts`）：
   - 兼容：若带 Bearer/refreshToken，按 token 失效对应 Session（含其 access 子 token）；否则走现有 cookie `destroySession`。

6. **`withUser` 零改动**：因 `getCurrentUser()` 已双通道，`src/auth/api.ts` 不用动。

#### 验收标准（T1）

- Web 端登录/登出/访问受保护页面行为完全不变（回归）。
- 用 curl 模拟：`login` 拿 accessToken → 带 `Authorization: Bearer` 访问某个 `withUser` 端点返回 200；不带返回 401。
- access 过期后用 refresh 端点换新可继续访问。
- vitest 覆盖：`getUserByBearer` 命中/过期/非法、双通道优先级（Bearer 优先于 cookie）。

---

## T2 SQLite → Postgres 迁移

### 现状

- `prisma/schema.prisma`：`datasource db { provider = "sqlite"; url = env("DATABASE_URL") }`。
- `prisma/dev.db` 本地文件库；`prisma/migrations` 已有历史 migration（**SQLite 方言，不能直接用于 Postgres**）。
- 大量 `*Json String` 字段（手动 JSON.stringify 存储）、若干 `@@unique` 复合约束。

#### 步骤

1. **起本地 Postgres**：docker compose 起一个 `postgres:16`，`DATABASE_URL=postgresql://...`（dev/staging/prod 三套 env）。
2. **切 provider**：schema `provider = "postgresql"`。
3. **重建 migration**：因 SQLite 历史 migration 与 PG 不兼容，方案二选一：
   - **A（推荐，干净）**：归档旧 `migrations` 目录 → `prisma migrate dev --name init_postgres` 生成全新 PG 初始 migration。自用/小数据量，无需保数据。
   - B：若必须迁移现有 dev 数据，导出 SQLite → 转换脚本 → 导入 PG（成本高，自用一般不需要）。
4. **回归校验 JSON 字段**：现存 `*Json` 仍以 `String` 存（保持不变，避免大改），确认 PG 下读写一致；后续可选改 `Json` 原生类型（非 M0 范围）。
5. **校验约束差异**：复合 `@@unique`、`onDelete` 行为在 PG 下重跑 `prisma generate` + 全量 vitest（`src/test` 体系）确认无回归。
   - **重点回归 `onDelete: NoAction`**：`TrainingTask.goal` 与 `TrainingCompletion.linkedActivity` 显式用了 `NoAction`。SQLite 对 NoAction 强制较松，Postgres 严格——删 Goal / ActivityRecord 时会直接抛 FK 错而非级联。需确认这些删除路径的预期行为（是否应改 `Cascade`/`SetNull`，或保持 NoAction 并在 service 层先清引用）。
6. **`src/db/client.ts`**：无需改（PrismaClient 通用）；确认连接池在 serverless/常驻两种部署下的配置（如用 PgBouncer/`connection_limit`）。
7. **seed**：`scripts/seed.ts` 在 PG 上跑通（`npm run seed`）。

#### 验收标准（T2）

- `prisma migrate dev` 在空 PG 上成功建全表。
- `npm run seed` 成功；`npm test` 全绿。
- 本地用 PG 跑 `npm run dev`，Web 端登录 + 关键页面（计划/今日/Agent）功能正常。

---

## T3 `/api/v1` 契约冻结 + zod 类型共享

### 现状

- 23 个 route 散落 `app/api/**`，无版本前缀。
- 校验基础在 `src/domain/validation.ts`（已用 zod），但请求/响应 schema 未系统化。
- 部分数据仅经 RSC 渲染，**缺独立 GET 数据端点**（看板聚合等）。

#### 步骤

1. **建版本层**：新增 `app/api/v1/**`，以**薄转发**复用现有 handler（import 现有 route 的逻辑函数，或把核心逻辑下沉到 `src/services` 后两个版本共用）。优先不复制业务逻辑。
   - **前置：inline 逻辑下沉清单**。部分 route 的编排逻辑全在 route 内联、未下沉到 service，薄转发不可行。需先把这些逻辑下沉为 service 函数，再让 v1 与原 route 共用。已识别：
     - `app/api/agent/route.ts`（200+ 行：动作解析、安全 guard、执行、记忆应用、消息落库、summary 刷新）——下沉到 `src/services/agent` 的 orchestration 函数。
     - 其余 route（profile/goals/plan/training/sync/settings/agentConversations 等）逻辑多已在 `src/services/**`，可直接薄转发。
   - 下沉时保留原 `/api/*` handler 行为不变，仅做提取重构。
2. **定义契约 schema**：新建 `src/contracts/`（或 `src/domain/contracts.ts`），用 zod 写每个端点的 `requestSchema` / `responseSchema`。客户端将来 import 同一份。
   - 先覆盖 P0/P1 端点：auth、profile、goals、plan、training/tasks/completion、agent、agent/conversations。
3. **统一错误格式**：约定 `{ error: string, code?: string }`，封装一个 `jsonError(code, message, status)` helper，逐步替换现有零散 `NextResponse.json({ error })`。
4. **补缺失的 GET 端点**：盘点看板/Insights 页面在 RSC 内直接算的聚合，抽成 `GET /api/v1/insights/...`，返回结构化 JSON（供 App 图表用）。**先盘点列清单，再逐个补**。
5. **增量参数**：列表端点（activity/sleep/recovery）加 `?since=<ISO>` 支持。**注意这些表无 `updatedAt`**——activity 用 `startedAt`、sleep/recovery 用 `date` 过滤，createdAt 作为兜底；不要假设 updatedAt 存在。
6. **OpenAPI（可选）**：用 zod-to-openapi 从 contracts 生成 `openapi.json`，便于客户端核对（非阻塞）。

#### 验收标准（T3）

- `/api/v1/*` 端点可用，响应过对应 `responseSchema.parse` 不报错。
- 现有 `/api/*`（无 v1）保持可用，Web 不受影响。
- P0/P1 端点契约 schema 齐全并被复用（前后端同一份 zod）。
- 看板所需数据均有独立 GET 端点（缺口清单清零）。

---

## M0 总验收

- Web 端全功能回归通过（cookie 鉴权 + PG + 现有 `/api/*` 不变）。
- 原生端可用 Bearer 完成「登录 → 访问受保护端点 → 刷新 token」闭环（curl 验证）。
- P0/P1 端点在 `/api/v1` 下有冻结契约与 zod 类型，可交给 M1 客户端直接对接。
- `npm test` 全绿；新加鉴权/契约逻辑有单测覆盖。

## 开放问题（执行前需定）

1. **部署平台**：决定 Postgres 托管在哪（影响连接池配置 + env 管理）。Vercel + 托管 PG（Neon/Supabase）还是自建。
2. **access token 形态**：落表（最简单、可即时吊销）vs 无状态 JWT（省查询、但吊销难）。本清单默认**落表**，如需改 JWT 在 T1 步骤 2 调整。
3. **是否本阶段就把 `*Json` 改 PG 原生 `Json`**：默认否（保持 String，减小回归面），留作后续。
