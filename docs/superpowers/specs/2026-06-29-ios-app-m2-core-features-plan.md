# iOS App · M2 核心功能 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M2 阶段，依赖 M0 + M1 完成）

## 这份清单的范围

M2 目标：**在 M1 骨架上填出第一条日常可用闭环 —— 今日训练、打卡、周计划（P0）**。完成后用户每天能用 App：看今天练什么 → 打卡完成 → 查看/生成本周计划。数据看板、Agent、目标留给 M3。

**前置依赖**：

- M0：`/api/v1` + Bearer + Postgres 就绪。
- M1：API client（自动刷新）、5 Tab 骨架、设计底座、共享 contracts 包就绪。

### 关键现状（已盘点）

- **打卡端点已存在**：`POST /api/training/tasks/[id]/completion`，body 走 `trainingCompletionSchema`（`actualLoad / perceivedEffort / notes / linkedActivityId / items`），调 `completeTrainingTask`。**可直接复用，纳入 `/api/v1`**。
- **计划生成端点已存在**：`POST /api/plan/generate`，body `{ weekStart }`（必须是用户时区周一零点），调 `generatePlanForUser`。**可直接复用**。
- **读取计划/今日数据无独立端点**：现仅在 `app/(dashboard)/plan/_data.ts` 用 RSC + `cache()` 直接查 prisma（`getActivePlan` 含 `trainingTasks` + `checklistItems`、`getActivePlanSummary`、`getRecentActivities`、`getLatestRecovery/Sleep` 等）。**M2 必须把这些读逻辑抽成 `/api/v1` GET 端点**——这是 M2 后端的主要工作。
- 数据形态：`Plan` 含 `trainingTasks[]`，task 含 `checklistItems[]`、`status(planned/...)`、`completion`、`scheduledStart/End`、`targetJson`。

执行顺序：T1 后端读端点 → T2 数据 hooks → T3 今日 Tab → T4 任务详情+打卡 → T5 计划 Tab → T6 联调。

---

## T1 后端：补齐计划/今日的 GET 端点

把 `plan/_data.ts` 的读逻辑下沉为可复用 service + `/api/v1` 端点（Web 的 RSC 可后续改为共用同一 service，本阶段不强制）。

### 步骤

1. **下沉读逻辑**：新建/扩充 `src/services/planService` 中的纯读函数（或新 `src/services/planQueryService.ts`），把 `getActivePlan` / `getActivePlanSummary` / `getRecentActivities` / `getLatestRecovery` / `getLatestSleep` 从 RSC `_data.ts` 抽出（去掉 `cache()`，改普通 async）。
2. **新增端点**：
   - `GET /api/v1/plan/active` → 当前未 superseded 的计划 + `trainingTasks`(含 `checklistItems`) + summary/nutritionTargets。
   - `GET /api/v1/today` → 聚合「今天」视图：今日 task 列表（按用户时区取当天）、最近 recovery/sleep 概要、主目标。便于今日 Tab 一次拉齐。
   - （可选）`GET /api/v1/plan/week?weekStart=` → 指定周计划，供切周查看。
3. **契约**：在 `packages/contracts` 加 `planActiveResponseSchema`、`todayResponseSchema`、`trainingTaskSchema`（含 checklist、completion、status 枚举），mobile/web 共享。
4. **时区**：今日范围按 `user.timezone`（schema 默认 `Asia/Shanghai`）计算当天起止，复用现有 `isWeekStartInTimezone` 同源的时区工具。
5. **打卡 & 生成端点纳入 v1**：`/api/v1/training/tasks/[id]/completion`、`/api/v1/plan/generate` 薄转发到现有 handler（逻辑不复制）。

### 验收（T1）

- curl 带 Bearer：`GET /api/v1/today` 返回当天任务 + 恢复/睡眠概要；`GET /api/v1/plan/active` 返回完整周计划。
- 响应过对应 zod schema.parse 不报错。
- Web 端原有 plan 页不受影响（RSC `_data.ts` 暂可不动）。

---

## T2 客户端数据层（hooks）

### 步骤

1. `apps/mobile/src/features/plan/api.ts`：基于 M1 的 API client + TanStack Query 封装：
   - `useTodayQuery()` → `/api/v1/today`
   - `useActivePlanQuery()` → `/api/v1/plan/active`
   - `useGeneratePlanMutation()` → `POST /api/v1/plan/generate`
   - `useCompleteTaskMutation()` → `POST /api/v1/training/tasks/[id]/completion`
2. 统一 query key 约定（`["today"]` / `["plan","active"]`），mutation 成功后 `invalidateQueries` 对应 key（等价 Web 的 `router.refresh()`）。
3. 响应过共享 zod schema 校验。

### 验收（T2）

- 三个 query/两个 mutation 可独立调用，类型从 contracts 推导，校验通过。

---

## T3 今日 Tab（Today）

### 步骤

1. 布局：顶部「今日概要」卡（日期、主目标、恢复/睡眠状态徽标），下方「今日训练任务」列表。
2. 任务卡片：标题、类型、时长、强度、计划时间窗（`scheduledStart/End`）、完成状态徽标（planned/completed/skipped）。
3. 空态：今天无任务 → 引导去「计划」Tab 生成。
4. 点任务卡 → 进任务详情（T4）。
5. 接 T6 设计底座的三态（loading/error/empty）。

### 验收（T3）

- 今日 Tab 展示真实当天任务与概要；无任务时显示引导空态。

---

## T4 任务详情 + 打卡（核心闭环）

### 步骤

1. **任务详情屏**：展示 task 全量（targetJson 解析后的目标、checklist 项）。
2. **Checklist 交互**：勾选 `checklistItems`（必做/选做），对应打卡 body 的 `items`。
3. **打卡表单**：`perceivedEffort`（主观强度）、`notes`、可选 `actualLoad`、可选 `linkedActivityId`（关联已同步的活动记录，M2 可先留空/简化）。字段严格对齐 `trainingCompletionSchema`。
4. **提交**：调 `useCompleteTaskMutation` → 成功后乐观更新任务状态为 completed + invalidate `["today"]`/`["plan","active"]`。
5. **失败处理**：mutation 失败回滚乐观更新 + 错误提示（用 M1 的 ApiError 映射）。

### 验收（T4）

- 完成一次真实打卡：勾 checklist + 填主观强度 → 提交 → 今日 Tab 与计划 Tab 状态同步更新。
- 断网/失败时乐观更新回滚、有错误提示。

---

## T5 计划 Tab（Plan）

### 步骤

1. **周计划视图**：按天分组展示 `trainingTasks`（周一到周日），每天的任务卡复用 T3 卡片组件。
2. **计划元信息**：summary、营养目标（`nutritionTargetsJson` 解析）、训练负荷目标。
3. **生成计划**：当无 active plan 或用户主动触发时，调 `useGeneratePlanMutation`：
   - 客户端按用户时区算「本周一零点」作为 `weekStart`（必须满足后端 `isWeekStartInTimezone` 校验，否则 400）。
   - 生成中 loading 态；成功 invalidate 计划 query。
4. **错误**：weekStart 非法/生成失败的提示。
5. 任务卡点击 → 同样进 T4 详情。

### 验收（T5）

- 无计划时可一键生成本周计划并渲染；有计划时按天展示，点任务进详情。
- 生成的 weekStart 通过后端时区校验（不出现 400）。

---

## T6 端到端联调

### 步骤

1. 真机指向 dev 后端，跑通完整闭环：登录 →（无计划）生成本周计划 → 今日 Tab 看到当天任务 → 打卡 → 状态同步。
2. 验证多端同步：App 打卡后，Web plan 页刷新应看到同样的完成状态（同库）。
3. 回填缺口：T1 端点若有字段不足，补 contracts 与端点。

### 验收（T6）

- 真机完成「登录→生成计划→今日打卡→Web 端可见同步」全链路。

---

## M2 总验收

- 用户每天可用 App 完成核心闭环：看今日训练 → 打卡 → 查看/生成周计划。
- 打卡/生成复用现有 service（业务规则不变），读数据走新 `/api/v1` GET 端点。
- 乐观更新 + query 失效保证 App 内与 Web 数据一致。
- 今日/计划相关 contracts 齐全，可进入 M3（看板/Agent/目标）。

## 开放问题（执行前需定）

1. **`/today` 聚合粒度**：一个聚合端点（今日 Tab 一次拉齐，省往返）vs 多个细端点（更通用）。默认聚合端点 + `/plan/active` 细端点并存。
2. **`linkedActivityId` 是否 M2 就做**：把打卡关联到已同步的 COROS 活动记录。默认 M2 先不做（留空），M3/M4 接看板与同步后再补。
3. **Web RSC 是否本阶段改为共用下沉后的 service**：默认不动 Web（`_data.ts` 保留），仅新增端点；后续再统一，避免一次改动面过大。
4. **切周查看**：`/plan/week` 是否 M2 就要。默认只做 active plan，切周留 M3。
