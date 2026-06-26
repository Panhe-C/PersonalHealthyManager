# Agent 受限执行层设计（功能盘点结论）

日期：2026-06-26
状态：已通过 brainstorming 确认，待 writing-plans

## 盘点结论

本次对 Healthy Body Manager 全站功能做了审视，结论是：**现有功能边界基本合理，核心落差在 Agent 层**。

定位已确认为"并重"：规则引擎保安全底线，Agent 做个性化。但现状 Agent 是纯只读解释器——只能读 context、生成文字，没有任何写入通道，与"个性化"定位不符。真正改计划的只有打卡触发的规则重排。

因此本次唯一的大改动方向：**把 Agent 从"解释器"升级为"受限执行者"**，其余模块（规则引擎、打卡重排、COROS、Settings）作为基线保留。同时把当前未提交的食堂菜单 MCP 接入纳入联动。

## 关键设计决策

1. **目标**：审视现有功能合理性（非新增/重构）
2. **范围**：全站
3. **定位**：规则引擎保安全 + Agent 做个性化（并重）
4. **核心落差**：Agent 现状是纯只读解释器，与"个性化"定位不符
5. **方向**：给 Agent 真实写入能力
6. **护栏**：分级确认——低风险自动、高风险确认
7. **实现路径**：方案 A —— 动作注册表 + 确认门 + 安全上限复用
8. **食堂菜单**：保留 MCP 接入并与计划/Agent 联动
9. **飞书日历写回**：本次不决，保持现状（mock externalEventId）

## §1 架构与组件边界

在现有分层上新增一个 **动作层（Action Layer）**，位于 Agent 服务和现有业务 service 之间。Agent 永远不直接写 Prisma，只通过 executor → service，保证所有写入仍走现有业务规则。

```
用户消息
  → agent.ts 意图路由（复用现有 AgentIntent）
  → 模型调用（复用现有 OpenAI/Anthropic 双协议）
  → 动作提案解析：模型回复 → 解析为 AgentActionProposal[]
  → AgentActionRegistry 校验：参数 schema + 安全上限
  → 风险分流
       低风险 → 直接执行 executor → 现有 service
       高风险 → 存为 pending proposal → AgentPanel 渲染确认卡
  → 执行结果 + 文字回复 → 写入 AgentMessage（metadataJson 记录动作审计）
  → PlanAdjustment 落 trigger="agent"
```

**新增单元（每个单一职责、可独立测试）：**

| 单元 | 职责 | 依赖 |
|---|---|---|
| `src/services/agentActions/registry.ts` | 动作注册表：id/风险/schema/executor/是否需确认 | 无 |
| `src/services/agentActions/proposals.ts` | 解析模型回复为结构化 `AgentActionProposal[]` + schema 校验 | registry |
| `src/services/agentActions/safetyGuard.ts` | 把提案喂给规则引擎安全约束做上限校验，越界拒绝/降级 | planning/engine |
| `src/services/agentActions/executor.ts` | 按动作 id 分发到现有 service，包事务 + 写 PlanAdjustment | planService/checklistService/calendarDraftService |
| `src/services/agentActions/pendingProposals.ts` | 高风险提案的持久化 | prisma |
| `app/api/agent/proposals/[id]/confirm` route | 用户确认高风险提案的执行端点 | executor |
| `AgentPanel` 确认卡子组件 | 渲染 pending proposal、确认/拒绝 | 现有 AgentPanel |

**菜单联动单元**（属 §4，非动作层核心，但被动作层调用）：`src/services/mealMenuService.ts`（新），封装菜单 TTL 缓存与 MCP 拉取，被 `recommend_menu` executor 和 `agentContext` 调用。

**保留不动**：规则引擎、打卡重排、COROS、Settings、意图路由逻辑。

**关键边界约束**：安全上限是"硬墙"——Agent 提议越界时 guard 直接降级到规则基线，不让模型绕过。Agent 的所有写入必须经 executor → service，无例外。

## §2 动作注册表与风险分级

初始动作集合（保守起步，可后续扩展）：

| 动作 id | 风险 | 需确认 | 参数 | 执行器调用 | 安全上限 |
|---|---|---|---|---|---|
| `explain_plan` | 只读 | 否 | — | 无写入，纯文字 | — |
| `adjust_task_intensity` | 低 | 否 | `taskId`, `intensity∈{recovery,easy,moderate}` | 改 TrainingTask.intensity + 重建该任务 checklist | guard：若任务处于恢复约束下，禁止升到 moderate+；越界降级为 easy |
| `reschedule_task` | 低 | 否 | `taskId`, `newDate` 或 `newWindow` | 改 TrainingTask.date/scheduledStart/End + 同步草稿 | guard：新窗口必须在日历 freeWindows 内；否则拒绝 |
| `skip_task` | 低 | 否 | `taskId`, `reason` | 标记 skipped + 触发现有保守重排 | 复用现有重排规则 |
| `regenerate_plan` | 高 | 是 | `weekStart`, `options?` | 调 planService.generatePlanForUser | 复用引擎全约束 |
| `confirm_calendar_draft` | 高 | 是 | `draftId` 或 `all` | 调现有 confirm 端点 | 现有确认流程 |
| `recommend_menu` | 只读+联动 | 否 | `date?`, `meal?` | 读 stdio MCP 菜单 + 当前训练强度，返回推荐 | — |

**分级原则**：
- **只读**（explain/recommend_menu）：无写入，不需确认。
- **低风险自动**（adjust/reschedule/skip）：改单个任务、可逆、有安全上限兜底，Agent 直接执行。
- **高风险确认**（regenerate/confirm_draft）：影响整周计划或外部日历，必须用户在前端点确认。

**安全上限（safetyGuard）的核心规则**：
1. 任何 `intensity` 上调都要先查当前 `poorSleep/poorRecovery/injury` 状态——若任一为真，禁止上调，最多维持或降到 easy。
2. `reschedule` 的目标窗口必须落在 `CalendarSnapshot.freeWindows`，且不与已有重要事件冲突。
3. guard 拒绝时返回 `{accepted: false, reason, fallback}`，Agent 回复里要如实告诉用户"我尝试了 X 但被安全规则拦下，已改为 Y"——**不允许静默忽略**。

**未纳入初始集合的动作**：创建新任务、删除任务、改目标——这些会破坏计划完整性，超出"个性化微调"范畴，留作未来扩展。

## §3 动作提案协议与模型约束

Agent 现状是"自由文本回复"。方案 A 要求模型在回复里附带**结构化动作提案**，同时保留自然语言解释。

**模型输出格式**（在 system prompt 里强制约束）：

```
<explanation>自然语言解释给用户看</explanation>
<actions>
[
  {"id": "adjust_task_intensity", "args": {"taskId": "abc", "intensity": "easy"}},
  {"id": "recommend_menu", "args": {"meal": "lunch"}}
]
</actions>
```

**解析流程**（`proposals.ts`）：
1. 用容错解析抽 `<actions>` 块里的 JSON 数组（缺失则视为纯解释，无动作——和现状兼容）。
2. 对每个动作查 registry：未知 id → 丢弃 + 记 warn；参数不匹配 schema → 丢弃 + 记 warn。
3. 通过校验的提案进 safetyGuard。
4. guard 通过的低风险动作 → executor 立即执行；高风险 → 持久化为 pending proposal，前端渲染确认卡。
5. 最终回复给用户的文字 = 模型 `<explanation>` + 执行结果摘要（"已把周三强度降为 easy""已为你生成菜单建议""需要你确认是否重生成本周计划"）。

**模型 prompt 约束要点**（加进现有 `systemPrompt`）：
- "只能使用以下动作 id：…（列出 registry 中的 id）"
- "不要编造动作 id 或参数"
- "低风险动作可以提议执行；高风险动作只能提议，由用户确认"
- "若安全规则拒绝你的提议，照实告诉用户"
- "动作提案必须放在 `<actions>` 块中，其余为给用户的解释"

**降级兼容**：
- 模型不输出 `<actions>` → 回退到现状纯解释行为，不报错。
- 模型输出非法动作 → 丢弃非法项，保留合法项，回复照常。
- 未配置 API key → 完全走现有规则降级（`createAgentResponse`），无动作能力——没模型就没法做个性化。

**测试策略**：proposals 解析、guard、registry 都用单元测试（vitest 现有体系），用 factories 造 task/plan；executor 集成测试用 prisma 事务回滚。

## §4 食堂菜单联动

当前未提交改动已实现：`meal-menu-mcp.ts` stdio MCP 拉菜单 + `planService.resolveMealMenusForPlan` 在生成计划时取菜单。但联动止于计划生成——菜单数据存进了 `Plan.menuRecommendationsJson`，却没和 Agent、打卡、营养建议打通。

**联动设计（在方案 A 动作层下打通）：**

1. **`recommend_menu` 动作读实时菜单**：不再只读计划里缓存的 `menuRecommendationsJson`，而是按用户请求的日期/餐次实时调 `fetchMealMenusFromStdioMcp`，结合当前训练强度（从最新 plan task 取）给建议。
   - 失败回退：MCP 拉取失败 → 回退 mock（现有逻辑）+ 如实告诉用户"实时菜单拉取失败，用缓存建议"。

2. **菜单影响计划生成**：`generatePlanForUser` 已在用菜单算 `nutritionTargets`，但只算"推荐/慎选"列表。增强：把当日菜单的蛋白质是否达标作为一个软信号，纳入计划 explanation（"今日菜单蛋白质偏少，已在你训练后补充建议"）——纯展示，不动训练任务。

3. **Agent 上下文注入菜单**：`agentContext.ts` 的 `menu_advice` 意图分支，目前只读 `plan.menuRecommendationsJson`。增强为：尝试实时拉今日菜单注入 context，让模型看到具体菜品而非只是缓存推荐列表。

4. **菜单数据持久化 + TTL 缓存**：stdio MCP 拉到的菜单 upsert 进 `MealMenu` 表（和 COROS 一样）。缓存策略为**当日有效、跨天重拉**（菜单本身按日期，自然以日为 TTL）。`recommend_menu` 动作或 `menu_advice` 意图时优先读当日已缓存的 `MealMenu`，缺失或过期才拉 MCP——避免每条消息都 spawn 子进程。

**边界约束**：
- stdio MCP 子进程开销大（每次 spawn npx），不能每条 Agent 消息都拉。策略：仅 `recommend_menu` 动作或 `menu_advice` 意图触发拉取，且优先读当日缓存。
- 菜单只影响营养建议和计划说明，不改训练任务——营养是"个性化补充"，不触碰安全基线。

**新增/改动单元**：
- `src/services/mealMenuService.ts`（新）：封装"读当日缓存 → 缺失/过期拉 MCP → upsert → 返回"。
- `planService.resolveMealMenusForPlan` 改为调 mealMenuService。
- `agentContext.loadMenuContext` 改为调 mealMenuService 取实时/缓存菜单。
- `recommend_menu` executor 调 mealMenuService。

## §5 数据模型与审计

新增一张表持久化高风险 pending proposal，并扩展审计记录。

**新增表 `AgentActionProposal`**：

```prisma
model AgentActionProposal {
  id             String   @id @default(cuid())
  userId         String
  conversationId String
  messageId      String   // 关联触发它的 AgentMessage
  actionId       String   // registry 中的动作 id，如 regenerate_plan
  argsJson       String   // 经 schema 校验的参数
  riskLevel      String   // high
  status         String   @default("pending") // pending|confirmed|rejected|executed|failed|expired
  resultJson     String?  // 执行结果或失败原因
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation AgentConversation @relation(fields: [conversationId, userId], references: [id, userId], onDelete: Cascade)
  message      AgentMessage      @relation(fields: [messageId, userId], references: [id, userId], onDelete: Cascade)

  @@index([userId, status])
  @@unique([id, userId])
}
```

**扩展 `PlanAdjustment`**：现有 `trigger` 字段（当前打卡重排用）增加 `agent` 取值，记录 Agent 执行的每个写入动作。`previousStateJson/newStateJson` 已有，复用。

**扩展 `AgentMessage.metadataJson`**：现有 metadata 存对话元数据，增加记录该消息触发的动作提案摘要（actionId、status、执行结果），让对话历史可追溯"AI 这条消息改了什么"。

**数据生命周期**：
- pending proposal 确认 → status `confirmed` → executor 执行 → `executed` 或 `failed`。
- 用户拒绝 → `rejected`。
- 跨周（plan superseded）后未确认的 proposal → `expired`（避免确认一个已失效的计划改动）。

**迁移**：新增一个 prisma migration，纯加表加字段，不动现有数据。

**测试**：factories 补 `buildAgentActionProposal`；集成测试覆盖 pending→confirm→executed 状态流转。

## §6 前端交互与错误处理

**AgentPanel 改动**（在现有组件上增量加，不大改）：

1. **确认卡渲染**：消息列表里，当某条 assistant 消息带 high-risk proposal 时，在其气泡下渲染一张确认卡：
   - 标题：动作的可读描述（"重生成本周计划""确认写入飞书日历"）
   - 参数预览：关键参数（如 weekStart、影响范围）
   - 两个按钮：`确认执行` / `拒绝`
   - 状态显示：pending → 执行中 → 已完成/失败
   - 失败时展示 `resultJson` 里的原因

2. **低风险动作的反馈**：低风险自动执行后，在 assistant 气泡底部追加一行执行结果摘要（"已将周三强度降为 easy""已把周五训练挪到上午 10:00"），用现有 `RichMessageContent` 的样式。

3. **刷新策略**：动作执行成功后，前端 `router.refresh()` 触发 RSC 重取，让 Plan 页的周计划/草稿同步更新，不整页 reload。

**错误处理分层**：

| 失败点 | 处理 |
|---|---|
| 模型不输出 actions | 回退纯解释（§3 已定） |
| 动作 id 非法/参数错误 | 丢弃该动作，回复照常，warn 日志 |
| safetyGuard 拒绝 | 不执行，回复如实告知"被安全规则拦下"+ 原因 + fallback |
| executor 调 service 失败 | proposal 标 `failed` + resultJson 记原因，前端确认卡显示失败，可重试 |
| 高风险确认时计划已 superseded | proposal 标 `expired`，前端提示"该提议已过期，请重新生成" |
| MCP 菜单拉取失败 | 回退 mock + 如实告知（§4 已定） |
| 未配置 API key | 走规则降级，无动作能力（§3 已定） |

**可访问性**：确认卡用 `role="dialog"` 或 `aria-live`，按钮有明确 aria-label（和现有 AgentPanel 删除确认的范式一致）。

**关键约束**：前端永远不直接调写入 API，只调 `/api/agent/proposals/[id]/confirm` 这个提案确认端点；实际写入由后端 executor 统一执行——保证安全上限只在后端 guard 处生效，前端绕不过。

## 范围与非目标

**本次范围内**：
- 新增动作层（registry/proposals/safetyGuard/executor/pendingProposals）
- 7 个初始动作的实现
- 食堂菜单 TTL 缓存 + 联动
- AgentActionProposal 表 + PlanAdjustment.trigger="agent"
- AgentPanel 确认卡 + 低风险反馈
- 提案确认 API 端点

**本次非目标（明确排除）**：
- 飞书日历真实写回（保持 mock，未来单独决策）
- 创建/删除任务、改目标等破坏计划完整性的动作
- 原生 tool-use 集成（方案 B，多 provider 适配成本高）
- 重写规则引擎或打卡重排
- 现有 `window.location.reload()` 的全局改造（仅 Agent 写入路径用 router.refresh）
