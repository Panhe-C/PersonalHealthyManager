# iOS App · M3 完整功能 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M3 阶段，依赖 M0+M1+M2 完成）

## 这份清单的范围

M3 目标：**功能对齐 Web 主路径 —— 数据看板(Insights)、教练对话(Agent)、目标管理(Goals)**。完成后 App 不只是「打卡器」，而是覆盖 Web 核心体验的完整客户端。设置/MCP(P2) 与上架打磨留给 M4/M5。

**前置依赖**：M0（v1+Bearer+PG）、M1（client/导航/契约）、M2（今日/计划/打卡闭环 + 数据 hooks 范式）。

### 关键现状（已盘点）

- **目标端点齐全可直接用**：`GET/POST /api/goals`（`listGoals`/`createGoal`）、`/api/goals/[goalId]`（改/删）。纳入 v1 薄转发即可。
- **Agent 对话是一次性 JSON（非 SSE）**：`POST /api/agent { message, conversationId }` → 返回 `{ message, conversation, adjustments, appliedMemories, intent, source, ... }`。客户端请求/响应即可，无需流式。
- **会话管理端点齐全**：`GET/POST /api/agent/conversations`（列表/新建）、`GET/DELETE /api/agent/conversations/[id]`（详情含消息/删除）。
- **撤销端点齐全**：`POST /api/agent/adjustments/[id]/undo` —— 对应 Agent 低风险动作的「事后撤销」交互。
- **记忆端点**：`/api/agent/memories`（+`[id]`）增删，可在设置/会话里管理（M3 可只读展示或推迟）。
- **看板数据无独立端点**：recovery/sleep/activity 趋势目前仅 RSC 直接查 prisma（`getLatestRecovery/Sleep`、`getRecentActivities`，见 `plan/_data.ts`）。**与 M2-T1 同类缺口，M3 需补 `/api/v1` GET 端点**。
- Web 端 Agent 交互参考 `components/AgentPanel.tsx`（消息列表、动作结果、撤销行）。

执行顺序：T1 后端补端点 → T2 目标 → T3 看板 → T4 Agent 对话 → T5 Agent 动作/撤销 → T6 联调。

---

## T1 后端：补看板端点 + 既有端点纳入 v1

### 步骤

1. **看板读端点**（新增，下沉读逻辑同 M2-T1 范式）：
   - `GET /api/v1/insights/activities?since=&limit=` → 活动记录列表（`ActivityRecord`，带 `startedAt/durationMinutes/distanceKm/avgHr/trainingLoad/intensity`）。
   - `GET /api/v1/insights/recovery?since=` → 恢复趋势（`RecoveryRecord`：recoveryPercent/hrv/restingHr/load）。
   - `GET /api/v1/insights/sleep?since=` → 睡眠趋势（`SleepRecord`：duration/qualityScore）。
   - 支持 `?since=<ISO>` 增量（M0-T3 约定），默认返回近 N 条/近 N 天。
2. **既有端点纳入 v1（薄转发，逻辑不复制）**：
   - 目标：`/api/v1/goals`、`/api/v1/goals/[goalId]`
   - Agent：`/api/v1/agent`、`/api/v1/agent/conversations`(+`[id]`)、`/api/v1/agent/adjustments/[id]/undo`、`/api/v1/agent/memories`(+`[id]`)
3. **契约**：`packages/contracts` 补 `goalSchema`、`agentMessageSchema`、`agentResponseSchema`、`conversationSchema`、`activitySchema/recoverySchema/sleepSchema`，前后端共享。

### 验收（T1）

- curl 带 Bearer：三个 insights 端点返回结构化趋势数据；goals/agent/undo 在 v1 下可用。
- 响应过对应 zod schema.parse 通过。
- Web 端原功能不受影响。

---

## T2 目标管理 Tab/页（Goals）

### 步骤

1. 数据 hooks（沿用 M2 范式）：`useGoalsQuery` / `useCreateGoalMutation` / `useUpdateGoalMutation` / `useDeleteGoalMutation`。
2. 列表：按 `priority` 排序展示目标（title/type/status/targetDate/metrics）。
3. 新建/编辑表单：字段对齐 `createGoal` 入参（title、type、priority、targetDate、metricsJson 结构）。复用 M1 设计底座组件。
4. 删除：确认后调 delete + invalidate `["goals"]`。
5. 状态切换（active/其他）：调 update。

### 验收（T2）

- 可增删改查目标，列表与详情/今日页的「主目标」保持一致（同库）。

---

## T3 数据看板（Insights）

### 步骤

1. 数据 hooks：`useActivitiesQuery` / `useRecoveryQuery` / `useSleepQuery`（带 since/limit）。
2. **图表**：选轻量 RN 图表库（如 `react-native-gifted-charts` 或 `victory-native`），渲染：
   - 训练负荷/活动量趋势（按周）
   - 恢复（recoveryPercent / HRV）趋势
   - 睡眠时长 + 质量趋势
3. **概要卡**：最近一次恢复/睡眠状态 + 本周训练量汇总。
4. **活动列表**：近期活动记录（可点开看单次详情，M3 可简化为只读列表）。
5. 三态处理（无数据时引导先同步 COROS / 等待数据）。

### 验收（T3）

- 看板渲染真实 recovery/sleep/activity 趋势；无数据时友好空态。

---

## T4 教练对话（Agent）— 对话主体

### 步骤

1. **会话列表**：`useConversationsQuery` → 展示历史会话（title/updatedAt），可新建（`POST conversations`）、删除（`DELETE`）。
2. **会话详情**：`useConversationQuery(id)` 拉消息历史，按时间渲染气泡（user/assistant）。
3. **发消息**：`useSendMessageMutation` → `POST /api/v1/agent { message, conversationId }`：
   - 乐观插入用户气泡 → 请求中显示「思考中」→ 返回后渲染 assistant 气泡（`response.message`）。
   - 一次性响应（非流式），按 spec §8 首期不做 SSE。
   - 返回的 `conversation`（含可能的新 title）更新列表。
4. **富文本**：assistant 内容复刻 Web `AgentPanel` 的 `RichMessageContent` 渲染（markdown/分段），按 RN 适配。
5. 发完消息后 invalidate 受影响的 query（计划/今日，因 Agent 可能改了计划）。

### 验收（T4）

- 可新建会话、发消息、看到 AI 回复与历史；会话列表标题/时间正确更新。

---

## T5 Agent 动作结果与撤销

### 步骤

1. **动作结果摘要**：`POST /api/v1/agent` 返回的 `adjustments`（Agent 执行的可逆调整）在对应 assistant 气泡下渲染一行摘要（"已把周三强度降为 easy" 等），范式参考 Web `AgentPanel`。
2. **撤销交互**：每条可撤销 `adjustment` 旁给「撤销」按钮 → 调 `POST /api/v1/agent/adjustments/[id]/undo` → 成功后标记已撤销 + invalidate 计划/今日 query。
3. **记忆反馈**：`appliedMemories`（AI 记住的偏好）可在气泡内轻提示（"已记住：…"），与 Web 一致；记忆管理页可只读展示（增删留 M4/可选）。
4. **失败处理**：undo 失败（已过期/不可逆）按返回的 error/status 提示。

### 验收（T5）

- Agent 改了计划后，App 内能看到调整摘要并一键撤销，撤销后计划/今日同步回滚。

---

## T6 端到端联调

### 步骤

1. 真机跑通：看板看趋势 → 目标增改 → 与 Agent 对话让其调整计划 → 查看调整 → 撤销 → 今日/计划同步。
2. 多端一致性：App 内 Agent 调整/目标变更，Web 刷新可见（同库）。
3. 回填 contracts/端点缺口。

### 验收（T6）

- 真机完成「看板→目标→对话→AI 调整→撤销」全链路，且与 Web 数据一致。

---

## M3 总验收

- Insights/Agent/Goals 三大模块在 App 可用，功能对齐 Web 主路径。
- Agent 走一次性 JSON（非流式），动作结果可撤销，记忆有反馈。
- 看板趋势数据走新 `/api/v1/insights/*` 端点；目标/Agent 复用既有 service（业务规则不变）。
- 进入 M4（HealthKit/推送/后台同步）前，App 已是功能完整的 Web 等价客户端。

## 开放问题（执行前需定）

1. **图表库选型**：`victory-native`（功能全、偏重）vs `react-native-gifted-charts`（轻、上手快）。默认后者，复杂图表再换。
2. **Agent 是否本阶段上 SSE 流式**：默认否（沿用一次性 JSON，spec §8），流式留作增强。若交互体感差再评估后端改 SSE 的成本。
3. **记忆管理（增删）**：M3 默认只读展示 `appliedMemories`，完整管理页（编辑/删除记忆）推迟到 M4 或设置页。
4. **看板时间范围/聚合**：按周聚合在客户端算 vs 后端返回聚合好的桶。默认后端返原始记录、客户端聚合（端点更通用），数据量大再改后端聚合。
