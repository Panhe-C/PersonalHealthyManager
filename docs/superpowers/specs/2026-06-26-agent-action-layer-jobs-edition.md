# Agent 受限执行层 · 乔布斯式精简方案

日期：2026-06-26
状态：备选方案（对照 `2026-06-26-agent-action-layer-design.md` 的精简版）

## 这版要回答的一个问题

原方案问的是"如何安全地让 Agent 写入"，答案是一套工程上漂亮的机器：动作注册表 + 风险分级 + 确认门 + pending proposal 表 + 确认卡。它对，但它让用户变成了一个**风险审批官**——每次 AI 想帮忙，都弹一张卡让他点"确认/拒绝"。

这版换一个问题：**用户早上醒来只想知道"今天怎么练、怎么吃、要不要休息"，我们怎么让 AI 直接给答案，而不是给他一堆待审批项？**

一句话定调：**把"事前确认"换成"事后撤销"。** AI 直接做，做错了一键回退。这不是降低安全性——安全底线仍由规则引擎硬墙兜住；变的只是"谁来承担不确定性"：从用户点确认，变成系统先扛、用户可反悔。

## 三条贯穿始终的原则

1. **可逆性 > 风险等级。** 只有"对外部世界产生不可逆副作用"的动作才事前确认；一切只改本地数据库的变更，一律直接执行 + 可撤销。
2. **撤销 > 确认。** 不让用户在事情发生前做决定，让他在事情发生后能反悔。复用已经存在的 `PlanAdjustment` 回滚基建，不造新机器。
3. **少一张表、少一个状态机、少一套模态。** 能删的都删。每删掉一个用户要做的决定，就是一次胜利。

## §1 架构：在原方案上做减法

保留原方案的分层骨架（Agent → 动作层 → 现有 service，Agent 永不直接写 Prisma），但动作层的内部单元**收敛**：

| 单元 | 去留 | 说明 |
|---|---|---|
| `agentActions/registry.ts` | 保留 | 动作注册表：id/schema/executor/可逆性 |
| `agentActions/proposals.ts` | 保留 | 解析模型回复为结构化动作 + schema 校验 |
| `agentActions/safetyGuard.ts` | 保留（不动） | 安全硬墙，越界降级——这是底线，原样保留 |
| `agentActions/executor.ts` | 保留 + 增强 | 执行前抓快照、执行后写**可逆** PlanAdjustment |
| `agentActions/pendingProposals.ts` | **删除** | 不再有 pending 状态机 |
| `/api/agent/proposals/[id]/confirm` | **删除 → 换** | 换成 `/api/agent/adjustments/[id]/undo` |
| AgentPanel 确认卡子组件 | **删除 → 换** | 换成气泡内一行"撤销" |

执行链路：

```
用户消息
  → agent.ts 意图路由（复用现有 AgentIntent）
  → 模型调用（复用现有双协议）
  → 解析动作提案（proposals.ts）
  → safetyGuard 硬墙校验（越界拒绝/降级，原样保留）
  → executor：抓快照 → 复用现有 service 执行 → 写可逆 PlanAdjustment(trigger="agent")
  → 文字回复 + 本次产生的可撤销调整摘要 → AgentPanel 气泡内渲染"撤销"行
```

没有"低风险分支 / 高风险分支"的分流，没有"存 pending 等确认"的旁路。唯一例外见 §2 的不可逆动作。

## §2 动作分级：从"风险"换成"可逆性"

| 动作 id | 副作用性质 | 交互 |
|---|---|---|
| `explain_plan` | 只读 | 无 |
| `recommend_menu` | 只读 + 实时菜单联动 | 无 |
| `adjust_task_intensity` | 改本地 DB（可逆） | 直接执行 + 撤销 |
| `reschedule_task` | 改本地 DB（可逆） | 直接执行 + 撤销 |
| `skip_task` | 改本地 DB + 级联重排（可逆） | 直接执行 + 撤销 |
| `regenerate_plan` | 改本地 DB（supersede，可逆） | 直接执行 + 撤销 |
| `confirm_calendar_draft` | **外部不可逆副作用** | **唯一保留事前确认** |

**核心判据**：副作用能不能在本地一键回滚？能 → 直接做。不能（写到飞书这种外部世界）→ 才需要事前点头。

注意 `regenerate_plan` 从原方案的"高风险确认"降为"直接执行 + 撤销"——它只是 supersede 上一版计划，撤销时把新计划标 superseded、把旧计划恢复 active 即可，完全可逆。而真实写飞书日历目前还是 mock（README），且 Plan 页本来就有"草稿 → 用户确认"流程，Agent 路由到现有草稿确认即可，**不需要 Agent 自建确认流**。

`safetyGuard` 的三条硬规则（强度上调先查 poorSleep/poorRecovery/injury；reschedule 必须落在 freeWindows；拒绝时如实告知不静默忽略）**全部原样保留**——精简的是交互，不是安全。

## §3 数据模型：扩展 PlanAdjustment，不新增表

**不要**原方案 §5 的 `AgentActionProposal` 表。改为给现有 `PlanAdjustment` 加四个字段：

```prisma
model PlanAdjustment {
  // 现有字段不动：trigger / previousStateJson / newStateJson / reason / explanation
  actionId  String?   // registry 动作 id
  messageId String?   // 关联触发它的 AgentMessage，让气泡找得到这条调整
  undoable  Boolean   @default(false)
  undoneAt  DateTime?
}
```

`previousStateJson` 升级为**被改动行的完整快照**（动作无关格式）：

```json
{
  "tasks": [{"id":"...","intensity":"easy","durationMinutes":40,"title":"...","date":"...","scheduledStart":"...","scheduledEnd":"...","status":"planned"}],
  "drafts": [{"id":"...","title":"...","startsAt":"...","endsAt":"...","notes":"...","status":"draft","failureReason":null}],
  "planIds": {"superseded":"...","created":"..."}
}
```

撤销逻辑只认这个快照、不关心是哪个动作产生的——通用、可单测。

**复用已存在的基建**：`checklistService.completeTrainingTask` 打卡重排时已经在事务里"改任务 + 写带前态的 PlanAdjustment"。撤销需要的"改完留快照"模式，代码里已经跑通——这版只是把同款模式接到 Agent 写入路径上。

## §4 Executor：执行前抓快照

```
async function executeAgentAction(tx, userId, action, messageId) {
  const affected = await collectAffectedRows(tx, userId, action); // 这动作会碰哪些行
  const before = serializeSnapshot(affected);

  await applyAction(tx, userId, action); // 复用现有 service：
  // adjust/reschedule/skip → 复用 checklistService 同款 updateAdjustedFutureTask 逻辑
  // regenerate → 复用 planService.generatePlanForUser

  return tx.planAdjustment.create({ data: {
    planId, userId, trigger: "agent", actionId: action.id, messageId,
    undoable: true,
    previousStateJson: before,
    newStateJson: serializeSnapshot(await collectAffectedRows(tx, userId, action)),
    reason, explanation
  }});
}
```

**`skip_task` 是最需要小心的动作**，单独成节细化于 §4.1。

## §4.1 skip_task 的级联撤销

`skip_task` 不是一个原子的单行变更——它复用现有保守重排逻辑（参照 `checklistService.completeTrainingTask` 第 269-275 行 skipped 分支），会把被跳过任务的部分负荷**摊到后续任务**上：下一个 future task 的 `durationMinutes` 增加、`title` 加前缀、可能还会改 `scheduledEnd` 并同步其 `calendarDraft`。也就是说一次 skip 可能改动 **N 个 task + N 个 draft**。如果快照只存被跳过的那一个任务，撤销后后续任务仍停在被加重的状态——半截脏数据。

**因此 skip 的撤销要满足"快照覆盖全部被触达的行"，分三步落地：**

1. **执行前，预演式收集受影响集合。** `collectAffectedRows` 对 skip 不能只返回目标任务，要先按现有重排规则算出"哪些 future task 会被改"，把目标任务 + 所有这些 future task + 它们关联的 calendarDraft 全部纳入快照。实现上有两种取法，二选一：
   - **预演（推荐）**：把"算出要改哪些行"从"实际改"中抽出来成纯函数，先跑一遍拿到将被改动的 id 集合，再据此抓 before 快照，然后才真正执行。
   - **宽收集**：直接快照"目标任务 + 同一 plan 下 `date > 目标日期 && status=planned` 的所有 future task + 其 draft"。实现简单，代价是快照偏大、可能含未被实际改动的行（撤销时写回原值，无害）。

2. **执行：复用现有重排，不另写一套。** 真正的 skip 走和 `completeTrainingTask` 同源的 `updateAdjustedFutureTask`，保证 Agent 触发的 skip 与打卡触发的 skip 行为一致，避免两套重排逻辑漂移。

3. **写一条快照覆盖全集的 PlanAdjustment。** `previousStateJson.tasks/drafts` 必须包含步骤 1 收集到的**所有**行的前态。撤销端点（§5）按这份全集逐行写回——目标任务恢复 `planned`，每个被加重的 future task 恢复原 `durationMinutes/title/scheduledEnd`，每个 draft 恢复原 `title/endsAt/notes/status`。

**边界约束**：
- 撤销前若其中任一 future task 已被用户打卡（`status != planned` 或已有 `completion`），则该任务不可安全回滚 → 撤销端点返回 409 "部分任务已开始，无法整体撤销"，不做半量回滚。
- skip 的快照天然比其他动作大，但仍是一次性 JSON，不引入新表；可单测：构造"1 跳过 + 2 后续"的 plan，跑 skip→undo，断言三任务与草稿逐字段还原。

## §5 撤销端点：一个通用端点替代确认端点

`POST /api/agent/adjustments/[id]/undo`：

```
- 按 userId 取 adjustment；断言 trigger="agent" && undoable && undoneAt == null
- 若关联 plan 已 superseded（跨周失效）→ 409 "该调整已过期，无法撤销"
- 事务内：按 previousStateJson 把每个 task/draft 写回；regenerate 则反向 supersede（新标 superseded、旧恢复 active）
- 标记 undoneAt = now
```

这同时接住了原方案 §5 想给 pending proposal 设计的 `expired` 生命周期——同一个"计划已失效"边界，现在集中落在撤销端点，逻辑更收敛。

## §6 前端：删确认卡，加一行"撤销"

`ChatMessage` 扩展为携带调整引用：

```ts
type ChatMessage = {
  id: string; role: string; content: string;
  adjustments?: { id: string; label: string; undoneAt: string | null }[];
};
```

- `/api/agent` 的 POST 返回体带上本次执行产生的 `adjustments`，`AgentPanel.send()` 接住。
- assistant 气泡底部，用现有 `RichMessageContent` 同款样式渲染一行：
  > 已将周三强度降为 easy · **撤销**
- 点"撤销" → `POST /api/agent/adjustments/[id]/undo` → 乐观标记"已撤销" → `router.refresh()` 让 Plan 页同步。

**没有模态、没有"确认/拒绝"双按钮、没有 pending 状态显示。** 安全失败时（guard 拦下）照旧在文字里如实告知"想 X 但被安全规则拦下，已改成 Y"。

唯一保留的确认：`confirm_calendar_draft` 走 Plan 页现有草稿确认 UI，Agent 不自建。

## §7 食堂菜单联动：与原方案一致

菜单部分（原方案 §4）保持不变并采纳：`recommend_menu` 实时拉当日菜单 + 当前训练强度给建议；TTL 当日缓存（`MealMenu` 表 upsert，缺失/过期才 spawn MCP）；菜单只影响营养建议与计划说明，不碰训练任务。菜单是"主动惊喜"而非"待审批项"——可以在午餐前主动推一句"今天练了间歇，香煎鸡胸 + 杂粮饭最配你"，这是产品的招牌时刻，不需要用户开口问。

## 相对原方案的净删除清单

- 删 `AgentActionProposal` 表（原 §5）
- 删 `agentActions/pendingProposals.ts`（原 §1）
- 删 `/api/agent/proposals/[id]/confirm`（原 §1）→ 换成 `/api/agent/adjustments/[id]/undo`
- 删 AgentPanel 确认卡子组件（原 §1/§6）→ 换成气泡内"撤销"行
- 原 §2 "低/高风险二分" → 改成"可逆/不可逆二分"，只有真实日历写回保留确认

净效果：**少一张表、少一个 pending 状态机、少一套模态交互**，复用已测试的 `PlanAdjustment` 回滚基建；用户面对的决定数量从"每次高风险动作点一次确认"降到"几乎为零（只在真实写日历时点一次）"。

## 范围与非目标

**本版范围内**：
- 收敛后的动作层（registry/proposals/safetyGuard/executor）
- 7 个动作，按"可逆性"而非"风险"分级
- PlanAdjustment 扩展（actionId/messageId/undoable/undoneAt + 快照格式）
- 通用撤销端点 + AgentPanel 气泡内"撤销"行
- 食堂菜单 TTL 缓存 + 联动（同原方案）

**本版非目标（明确排除）**：
- 飞书日历真实写回（保持 mock）
- `AgentActionProposal` pending 确认机制（本版删除）
- 创建/删除任务、改目标等破坏计划完整性的动作
- 原生 tool-use 集成（方案 B）
- 重写规则引擎或打卡重排
