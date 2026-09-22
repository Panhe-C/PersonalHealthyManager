# 真实用户可用性落地计划

最后更新：2026-07-31

## 判断

工程基础已经就位：注册与邮箱验证、双令牌会话、请求限流、设置项加密存储、校验式备份与回滚、单实例生产容器、启动即迁移、CI 全量检查。缺的不是打磨，而是这套系统至今仍假设"使用者就是作者"。以下按"真实用户会不会因此卡死"排序，而不是按开发难度排序。

与 [发布检查清单](release-checklist.md) 的分工：那份清单覆盖 iOS 上架与部署验收的操作项；本文覆盖需要写代码或补内容的产品缺口，并给出先后顺序。

### 已确认的产品决策（2026-07-31）

- **模型 API Key 继续由用户自行配置**，不做服务端托管。因此工作重点是把自配置这条路做顺，而非消除它。
- **餐食菜单在未配置 MCP 时不展示**，其他页面只保留推荐的饮食方案，不再回落到假数据。
- **飞书日历改造纳入计划**，不做隐藏处理。

---

## P0-0 严重安全问题：stdio MCP 允许任意用户在服务器上执行程序 — 已完成（2026-07-31）

**已修复。** 采用了下列选项 3 的收敛版本，并同时做了环境隔离：

- `normalizeConnection` 不再读取客户端提交的 `command` / `args`，一律取连接自身的默认值。用户能配置的只剩下会话与食堂名。
- `buildChildEnv` 用显式允许列表替代 `...process.env`，子进程拿不到 `SESSION_SECRET`、`SETTINGS_ENCRYPTION_KEY`、`DATABASE_URL`。
- 设置界面的命令与参数输入框改为只读展示。
- 测试：提交 `/bin/sh -c 'curl … $SETTINGS_ENCRYPTION_KEY'` 后存下来的仍是默认命令；子进程环境中不含上述三个变量。

以下为原始记录。

现状：餐食菜单的 stdio 通道直接 spawn 用户在设置里填写的命令。

```229:237:src/providers/meal-menu-mcp.ts
export async function fetchMealMenusFromStdioMcp(connection: DataMcpConnection, date: Date): Promise<MealMenu[]> {
  const env = buildDataMcpStdioEnv(connection);
  if (!env) throw new Error("Meal Menu LARK_SESSION is required.");

  const command = connection.command || "npx";
  const child = spawn(command, splitArgs(connection.args), {
    env: { ...process.env, ...env },
    stdio: "pipe"
  });
```

而 `command` 与 `args` 来自用户提交的设置，规范化时只做了字符串取值，没有白名单：

```445:446:src/settings/service.ts
    command: stringValue(input.command ?? base.command),
    args: stringValue(input.args ?? base.args),
```

影响：任何注册用户都可以让服务器执行任意可执行文件（无需 shell 注入，`command` + `args` 本身就够，例如指定解释器并传 `-e`）。由于子进程继承 `process.env`，`SESSION_SECRET`、`SETTINGS_ENCRYPTION_KEY`、`DATABASE_URL` 会一并泄露——拿到前两个即可伪造任意用户会话并解密所有已保存的模型 Key。单人自部署时这是"执行自己的命令"，多用户下这是完整的服务器沦陷路径。

对比参照：COROS 连接已经有白名单，`src/settings/service.ts` 第 1026 行会拒绝非官方区域 URL。stdio 命令缺少等价约束。

做什么，三种可选，任选其一即可解除阻断：

1. **改为远端 MCP（HTTP transport）**：`knownDataMcpTransports` 已经支持 `http`，餐食菜单改走 HTTP 并对 endpoint 做白名单或至少限制协议与内网地址（需防 SSRF）。这是唯一既保留用户自配置、又适合托管部署的方向。
2. **stdio 仅限自部署 owner**：在服务端按账号角色限制，普通用户不可写 `command` / `args`；同时把 stdio 配置项从面向普通用户的设置界面移除。需要先引入角色概念（当前 `User` 模型没有）。
3. **命令白名单 + 环境隔离**：只允许固定的若干命令，并停止继承 `process.env`（改为显式传入所需变量）。

无论选哪种，**停止继承完整 `process.env`** 都应当立刻做——这一步单独就把"泄露主密钥"降级为"执行受限程序"，改动只有几行。

验收：新增测试证明普通用户提交任意 `command` 会被拒绝；子进程环境中不含 `SESSION_SECRET` 与 `SETTINGS_ENCRYPTION_KEY`。

估算：仅收敛环境变量 0.5 人天；选项 1（HTTP 化 + SSRF 防护）2-3 人天；选项 2（引入角色）1.5-2 人天；选项 3 1 人天。

---

## P0 阻断项：不做，真实用户注册后必然撞墙

### P0-1 忘记密码与重置密码

**已完成（2026-08-01）**：按下述方案实现。`PasswordResetToken`（TTL 1 小时）+ `src/auth/passwordReset.ts` + `POST /api/auth/forgot-password` 与 `POST /api/auth/reset-password`（含 `/api/v1` re-export）+ `/forgot-password` 与 `/reset-password` 页面，`/login` 已加入口。重置成功在同一事务里删掉该用户全部 `Session`。移动端加了 `(auth)/forgot-password` 一屏，发信后引导用户在浏览器里打开链接（重置页仍是 Web 页，未做 deep link）。22 个新测试位于 `tests/api/authPasswordReset.test.ts` 与 `tests/api/authPasswordResetRoutes.test.ts`。

注意限流仍是进程内的（见 P3-1）：多实例部署下按邮箱/IP 的限额会被实例数放大。

现状：`app/api/auth/` 只有 login、logout、refresh、register、resend-verification、verify-email，全项目没有任何重置密码路由。而邮件已经在向用户承诺这个功能：

```60:63:src/email/templates.ts
  const paragraphs = [
    "Someone tried to create a Healthy Body Manager account with this email address, but an account already exists.",
    "If that was you, sign in instead. You can reset your password from the sign-in page if you have forgotten it.",
    "If it was not you, no action is needed: no new account was created and your existing account was not changed."
  ];
```

后果：用户忘记密码即永久失去账号和全部健康数据。作者本人不受影响，因为可以跑 `npm run owner:setup` 覆盖密码。

做什么：邮箱验证流程已经把这件事需要的每一块都实现过一遍，直接沿用同一套形状。

- 新增 `PasswordResetToken` 模型，字段与 `EmailVerificationToken` 一致（`tokenHash` / `expiresAt` / `consumedAt`），TTL 取 1 小时而非 24 小时。
- 在 `src/auth/registration.ts` 的同层新增重置逻辑，复用 `hashToken` 与"签发即删除同用户未消费令牌"的写法（见该文件第 27-44 行的注释与实现）。
- 三个端点：`POST /api/auth/forgot-password`、`POST /api/auth/reset-password`，以及 `app/api/v1/` 下的一行 re-export（照 `app/api/v1/auth/login/route.ts` 的写法）。
- 页面：`/forgot-password` 与 `/reset-password`，并在 `/login` 加入口。
- 重置成功后必须吊销该用户全部 `Session`（refresh 与 access 都要，`parentId` 级联已具备），否则旧设备仍持有会话。
- 与注册一致地防枚举：无论邮箱是否存在，响应都相同；按 IP 与按邮箱双维度限流，沿用 `src/security/rateLimit.ts`。
- 未验证邮箱的账号不发重置信，避免绕过验证流程激活账号。

验收：`tests/api/` 下补测试，覆盖有效令牌、过期、二次使用、未验证账号、限流、重置后旧会话失效六种情形。

估算：1.5-2 人天。

### P0-2 应用内引导与健康免责声明

**已完成（2026-08-01）**：

- 引导：`User` 上新增 `onboardingCompletedAt` 与 `healthDisclaimerAcknowledgedAt` 两个字段（迁移 `20260801030000_onboarding_and_disclaimer`）。`src/services/onboardingService.ts` 报告四步状态（身体资料 / 目标 / 日程快照 / 计划），`/onboarding` 页按依赖顺序列出，每步可跳过，结尾一次性确认免责声明并落库。Web 根 `/` 在未完成时重定向到 `/onboarding`；移动端 `(app)` 布局外层套 `OnboardingGate`，鉴权后拉一次状态，未完成则 `router.replace('/onboarding')`。
- 免责声明：`components/HealthDisclaimer.tsx` 提供统一文案，作为计划页 `PlanContent` 的常驻脚注、每条教练回复的脚注，以及 `/onboarding` 内的 callout；首次进入教练页时 `HealthDisclaimerGate` 弹一次性确认，确认后调用 `POST /api/onboarding/acknowledge-disclaimer` 落库，不再出现。移动端 onboarding 屏内含同样的文案与"我已知悉"按钮。
- 空状态：Plan 页已有 `SetupChecklist`（身体资料 + 日程），Goals 页本就并列表单与列表，Insights 页已用 `EmptyState`。本次未额外改动这三处空状态，因为它们已满足"说明下一步"的要求。

验收：新建账号后不看 README 能独立走到"生成出本周计划"——`/onboarding` 的四步带 CTA 链接到 `/profile`、`/goals`、`/plan`，且每步显示完成与否。新增 12 个测试（`tests/services/onboardingService.test.ts` 5 个、`tests/api/onboardingRoutes.test.ts` 5 个、`tests/components/HealthDisclaimer.test.tsx` 2 个）。

注意：引导状态查询走 `/api/v1/onboarding`（移动端）与 `/api/onboarding`（Web），同一 handler，已加 v1 re-export。

现状：全项目搜不到 onboarding 相关代码。新用户登录后落到空白界面，需要自己照 README 的六步顺序（填身体资料 → 加目标 → 生成本周计划 → 完成清单 → 更新训练 → 确认日历草稿）摸索，而这个顺序存在真实依赖：没有身体资料和目标，计划引擎产不出东西。

同时"不构成医疗诊断"这句话目前只存在于 `docs/privacy-policy.md` 第 23 行，界面上没有。一个会输出训练强度和恢复建议的健康应用，这句话必须出现在用户实际读到建议的地方。

做什么：

- 首次登录后的分步引导，按依赖顺序推进，每步可跳过但保留入口；完成状态落库（可复用 `AutomationState` 的 `kind` 模式或在 `User` 上加字段）。
- 空状态文案：Plan、Goals、Insights 在无数据时说明"下一步该做什么"，而不是留白。
- 免责声明：首次进入教练/计划时的一次性确认，以及计划页与教练回复的常驻脚注。Web 与移动端都要。

验收：新建账号后不看 README 能独立走到"生成出本周计划"。

估算：2-3 人天（Web + 移动端）。

### P0-3 餐食菜单：未配置 MCP 时不展示，只保留推荐饮食方案 — 已完成（2026-07-31）

**已实现。** `src/providers/meal-menu.ts` 及其测试已删除，`MealMenu["source"]` 不再有 `"mock"`。`loadMealMenusForDate` 返回 `ok` / `not_configured` / `failed` 三态，`resolveMealMenusForPlan` 未配置时返回空数组。教练上下文在无菜单时整段省略菜单小节；`NutritionPanel` 拆成"始终展示的热量与蛋白目标 + 仅在有菜单时展示的推荐/慎选清单"；移动端 Today 页原本就按空列表隐藏，并新增 `mealMenuStatus` 供后续区分未配置与失败。

**已决策的目标行为**：没有配置餐食 MCP 连接时，餐食菜单不在任何页面出现；其他页面只展示推荐的饮食方案。不再回落到假数据。

现状比预期好一些——真实 MCP 通道已经实现（`src/providers/meal-menu-mcp.ts`），mock 只是兜底。问题是兜底是静默的，且出现在两条独立路径上：

```30:52:src/services/mealMenuService.ts
  const connection = await loadDataMcpConnection(userId, "meal_menu");
  if (connection?.enabled && connection.transport === "stdio") {
    try {
      const menus = await fetchMealMenusFromStdioMcp(connection, dayStart);
      if (menus.length > 0) {
        // ... 写入缓存并返回
        return menus;
      }
    } catch {
      return getMockMealMenu(dayStart);
    }
  }

  return getMockMealMenu(dayStart);
```

`src/services/planService.ts` 的 `resolveMealMenusForPlan`（第 73-84 行）是同样的形状。两处都在"未配置"和"配置了但调用失败"两种完全不同的情况下返回同一份假数据。

一个必须注意的连带影响：`recommendMenuChoices` 的输出里，只有一部分独立于菜单。

```16:31:src/planning/nutrition.ts
  const items = input.menus.flatMap((menu) => menu.items);
  const recommended = items
    .filter((item) => item.proteinGrams >= 35 || item.tags.includes("light"))
    .sort((left, right) => right.proteinGrams - left.proteinGrams);
  const caution = items.filter((item) => item.tags.includes("fried") || item.fatGrams >= 30);

  return {
    calorieTarget: input.primaryGoal.toLowerCase().includes("loss") ? "moderate deficit" : "maintenance",
    proteinTargetGrams: 120,
    carbohydrateGuidance:
      input.trainingIntensity === "hard"
        ? "prioritize carbohydrates before and after training"
        : "keep carbohydrates moderate and pair them with protein",
    recommended,
    caution
  };
```

`calorieTarget`、`proteinTargetGrams`、`carbohydrateGuidance` 由目标与训练强度推出，没有菜单也成立——**这三项就是"推荐的饮食方案"，保留展示**。而 `recommended` 与 `caution` 是从菜单条目里挑出来的，没有 MCP 时必然为空数组，属于"菜单派生"内容，应随菜单一起隐藏。

做什么：

- 删除 `src/providers/meal-menu.ts` 与 `getMockMealMenu` 的全部调用点。
- `getMealMenusForDate` 与 `resolveMealMenusForPlan` 在未配置连接时返回空数组；配置了但调用失败时**不要静默返回空**，要能与"未配置"区分开——失败应记录并在设置页显示连接异常（P2-1 的监控会用到），否则用户永远不知道自己配错了。
- 消费方按"无菜单即隐藏整块"处理，不要渲染空标题：移动端 Today 页（`apps/mobile/app/(app)/(tabs)/today/index.tsx`）、Web 计划页（`app/(dashboard)/plan/_sections.tsx`）、以及 `src/services/agentContext.ts` 第 225-227 行的 `menuLines`（为空时应整段省略，而不是给模型一个空的菜单小节）。
- 营养区块拆成两层：饮食方案（三项指引）始终展示；菜单派生的推荐/慎选清单仅在有菜单时展示。
- 修正 `src/services/planQueryService.ts` 第 92-93 行的注释，它当前写的是"mock-backed when no meal menu connection is configured"。
- 历史数据：已生成的 `Plan` 里 `nutritionTargetsJson` 与 `menuRecommendationsJson` 已持久化了 mock 派生的推荐清单，需决定是清理还是随下次生成自然覆盖。
- 测试同步更新：`tests/providers/meal-menu.test.ts` 删除，`tests/services/mealMenuService.test.ts`、`tests/services/planServiceMealMenu.test.ts`、`tests/planning/nutrition.test.ts`、`tests/planning/engine.test.ts`、`tests/services/planQueryService.test.ts` 及 `src/test/factories.ts`（其中 `source: "mock"`）需改为覆盖"无菜单"路径。

验收：未配置 MCP 的新账号在 Today、计划页、教练上下文中都看不到任何菜单条目，但能看到热量/蛋白/碳水指引；配置并连接成功后菜单出现；配置了但连接失败时用户能在设置页看到错误。

估算：1.5-2 人天。

### P0-4 模型 Key 自配置的成功率 — 已完成（2026-07-31）

**已实现。** 模型探测抽成共享的 `probeModel`，区分"服务商明确拒绝（401/403）"与"当下连不上"：前者阻断保存并直接返回服务商的说明，后者照常保存，避免网络抖动把有效 Key 挡在门外。`credentialSource` 现在在 Web 与移动端都前置显示在 API Key 输入框旁，而不只在报错时附加。README 补充了"本服务需自备模型 Key"的定位。

引导流程中的"配置模型 Key"一步随 P0-2 一起做。

**已决策**：继续要求用户自带 API Key，不做服务端托管。因此这一项不再是"要不要托管"的决策，而是把这条路的失败率压下来。

现状：`src/settings/defaults.ts` 已经有 `credentialSource` 字段（第 118-167 行），为每家服务商说明"该去哪个平台申请"，chat 路径与 `Test model` 会把它附加到 401/403 之后。这是个好底子，但仍偏事后。README 用一整段解释各家 key 容易错配到哪个账号体系（Kimi Code 与 Open Platform、MiniMax 国内外站、GLM 与 z.ai），说明这一步连开发者都容易失败。

做什么：

- 保存时即时校验：存 Key 的同时发一次最小请求，失败则不保存并直接给出原因，而不是等到用户第一次和教练对话才报错。
- 在设置界面把 `credentialSource` 前置展示（申请入口链接 + 常见错配提示），而不只在报错时附加。
- 引导流程（P0-2）中把"配置模型 Key"作为明确一步，并说明不配置会失去哪些功能。
- README 与设置页明确产品定位：本服务需自备模型 Key。

估算：1-1.5 人天。

---

## P1 合规：不做，不能公开分发

### P1-1 隐私政策与服务条款

**已完成（2026-08-01）**：

- 公开页面：新增 `app/(public)/layout.tsx` 与 `app/(public)/privacy/page.tsx`、`app/(public)/terms/page.tsx`，均为静态预渲染。运营主体、联系邮箱、生效日期、部署地域、公开地址从环境变量渲染（`src/legal/policyMetadata.ts`），未配置时显示可见占位，本地开发仍可访问。
- 服务条款：新增 `docs/terms-of-service.md`（与 `/terms` 同源），覆盖服务性质、非医疗用途、账号与数据、第三方连接、可用性与免责、变更与终止、联系方式七节。
- 隐私说明：`docs/privacy-policy.md` 与 `/privacy` 同步更新，餐食与日历描述随 P0-3、P2-3 行为变化重写（餐食未配置时只保留通用饮食方案不回落假数据；日历写回仅服务 `HBM_LARK_CALENDAR_ACCOUNT_EMAIL` 指定账号，未配置则禁用）。
- 注册同意：`User` 新增 `termsAcceptedAt` 与 `termsAcceptedVersion`（迁移 `20260801040000_terms_acceptance`）。`registerRequestSchema` 增加 `acceptTerms: z.literal(true)`，`registerUser` 在新建与未验证账号重新注册两条路径都盖戳 `CURRENT_TERMS_VERSION = "2026-08-01"`；已验证账号不改动（防枚举）。Web `/register` 与移动端注册屏加入勾选框，链接到 `/privacy` 与 `/terms`，未勾选时提交禁用。
- 门禁：`release:check` 从原来 1 条"无占位符"扩展为 5 条（运营主体、联系邮箱格式、生效日期 YYYY-MM-DD、部署地域、markdown 无占位），未配置时全部 FAIL。
- 测试：新增/更新 29 个断言覆盖 terms 盖戳、未勾选拒绝、显式拒绝、已验证账号不动、preflight 新项与格式校验。

注意：法务审阅仍未做，`CURRENT_TERMS_VERSION` 与文案需在正式发布前由运营者确认。已存在的 owner 账号 `termsAcceptedAt` 为 null（迁移加的可空字段），无重新同意流程；上线前如需可补一个"首次进入时补同意"的 gate。

现状：关键字段仍是占位符。

```52:56:docs/privacy-policy.md
## 联系方式

- 运营主体：待填写
- 隐私联系邮箱：待填写
- 公开隐私政策地址：待填写
```

另外完全没有服务条款文档，且隐私政策只是仓库里的 markdown，没有对外可访问的网页地址——App Store 审核、邮件页脚、注册页勾选都需要真实 URL。

做什么：补全运营主体、联系邮箱、生效日期、部署地域与跨境说明；新增服务条款（至少覆盖服务性质、非医疗用途、账号与数据、可用性免责、终止条款）；在 Next.js 里加 `/privacy` 与 `/terms` 两个公开页面；注册页加入同意勾选并记录同意时间与版本。

隐私说明中关于餐食与日历的描述需随 P0-3、P2-3 的行为变化一起更新。

估算：1-1.5 人天（不含法务审阅）。

### P1-2 iOS 上架前置

**编码侧已就绪（2026-08-01）**：`apps/mobile/eas.json` 提供 development/preview/production 构建配置；`apps/mobile/app.config.js` 从 `EXPO_IOS_BUNDLE_IDENTIFIER` / `EXPO_PUBLIC_EAS_PROJECT_ID` / `EXPO_PUBLIC_API_BASE_URL` 注入发布值，本地仍回落 `app.json`。`release:check` 继续门禁这些字段。

**仍阻塞在运营操作**：Apple Developer Team、签名证书、Provisioning Profile、APNs、真机 HealthKit/推送验收、App Store 问卷与截图。这些无法在仓库里“写完”，必须持有 Apple 账号后按 `docs/release-checklist.md` 逐项打勾。

现状：`apps/mobile/app.json` 的 bundle identifier 仍是 `com.hbm.mobile`，没有 EAS project ID；Apple Team、签名证书、Provisioning Profile、APNs 凭据均未配置。`release-checklist.md` 的"发布前阻塞项"13 条全部未勾选，意味着 HealthKit 授权、后台读取、通知权限与推送到达从未在真机上验证。

做什么：按 `release-checklist.md` 逐项执行，`npm run release:check` 作为门禁。这部分是操作而非编码，但必须留出真机调试的余量。

估算：3-5 人天，且强依赖 Apple 账号与审核排队，不可压缩。

---

## P2 运营：不做，线上出问题你查不到

### P2-1 错误监控与结构化日志

**已完成（2026-08-01）**：`src/observability/logger.ts` 提供 JSON 结构化日志、`requestId`（经 `withUser` 注入 ALS）、强制脱敏（邮箱/密码/API Key/长 token/对话字段）。`captureError` 替换了注册/重发/重置密码/餐食 MCP/COROS 同步等处的裸 `console.*`。可选 `HBM_ERROR_WEBHOOK_URL` 在 error 级别转发到外部收集器（Sentry Relay / Better Stack 等），未配置时仅写 stdout。

现状：没有接入 Sentry / OpenTelemetry / 任何日志库，整个 `src` 与 `app` 中只有 4 处 `console.error`（`app/api/auth/register`、`app/api/auth/resend-verification`、`src/services/syncService.ts`、`src/providers/coros-mcp.ts`）。

后果：用户报"打不开"、"计划没生成"、"菜单没出来"时没有任何线索，只能靠复现。P0-3 要求区分"未配置"与"连接失败"，也依赖这一项才能把失败暴露出来。

做什么：接入一个错误上报服务，覆盖服务端路由、计划引擎、外部连接（COROS、餐食 MCP、模型、邮件）与移动端崩溃；请求日志带 requestId 并贯穿到 Agent 调用；**上报前必须脱敏**——健康数据、邮箱、模型 Key、对话内容都不能进日志，这一点对健康类应用是硬要求。

估算：1.5-2 人天。

### P2-2 备份自动化与恢复演练

**已完成（2026-08-01）**：`data:backup` 支持 `HBM_BACKUP_OFFSITE_DIR` 异地拷贝；新增 `data:backup:prune`（`HBM_BACKUP_RETENTION_DAYS`，默认 14）、`data:drill` 恢复演练（报告写入 `backups/drill-reports/`）、`backup:service` macOS LaunchAgent（默认 24h）。说明见 `docs/backup-and-recovery.md`。

现状：`npm run data:backup` 与 `data:restore` 已实现且带 SHA-256 校验，但 README 只是让部署者"按计划把 `/data/backups` 拷到独立存储"——这个计划目前不存在，恢复演练也未做（`release-checklist.md` 已列为未完成）。

做什么：定时备份 + 异地上传；定义在线数据与离线备份的保留期限；完整走一次"删库到恢复"演练并记录耗时与数据损失窗口。

估算：1 人天 + 半天演练。

### P2-3 飞书日历改为标准 OAuth

**已决策**：纳入计划，不做隐藏处理。

**已止血（2026-07-31）**：`assertCalendarWriteAllowed` 仅允许 `HBM_LARK_CALENDAR_ACCOUNT_EMAIL`，未配置则禁用。

**OAuth 骨架已落地（2026-08-01）**：`src/providers/feishu-calendar-oauth.ts` + `src/services/feishuCalendarOAuthService.ts`；设置页「连接飞书日历（按用户 OAuth）」→ `POST /api/settings/feishu/oauth/start` → 回调写入用户 calendar 连接的加密 token。`confirmCalendarDrafts` 优先走用户 OAuth 写回，无 token 时仍走单账号 lark-cli 守卫。**真实联调仍需** `HBM_FEISHU_APP_ID` / `HBM_FEISHU_APP_SECRET` 与飞书应用日历权限；事件删除/账户删除后外部事件处理的实测仍在 checklist。

现状：日历写回调用本机 `lark-cli` 的本地登录身份（README 第 41 行）。这在单人开发机上成立，多用户下每个用户的日历授权无法工作——所有用户会共用部署者的飞书身份，既不可用也是越权。`release-checklist.md` 目前写的是"飞书日历能力暂缓"，需随本决策更新。

做什么：改为按用户的 OAuth 授权。COROS 已经把这条路走通了，可直接作为模板：应用内发起 → 携带单次令牌的 start URL → 系统浏览器授权 → 回调重定向到 app scheme（README 第 85-94 行；实现见 `src/auth/oauthHandoff.ts` 与 `src/settings/service.ts` 的 `createMcpOAuthAuthorizationUrl` / `handleMcpOAuthCallback`）。

同时要补齐 `release-checklist.md` 第 28 行列出的遗留项：事件删除权限，以及创建、更新、取消和"账户删除后外部事件如何处理"的实测。后者与隐私说明第 50 行的表述必须一致。

注意与 P0-0 的关系：日历走 OAuth + HTTP 之后，就不再需要本机命令行身份，这也顺带减少了一处依赖本机进程的设计。

估算：3-4 人天，含真实授权与四种事件操作的实测。

---

## P3 规模与收尾：开放注册前必须解决

### P3-1 SQLite 与进程内限流

**部分完成（2026-08-01）**：限流抽出 `RateLimitStore`；默认内存；配置 `HBM_RATE_LIMIT_REDIS_URL` + `HBM_RATE_LIMIT_REDIS_TOKEN`（Upstash HTTP）后跨实例生效。Postgres 迁移路径见 `docs/postgres-migration.md`，`npm run db:postgres:check` 做软检查。**尚未**把 `prisma/schema.prisma` 的 provider 切到 postgresql——那一步需要单独的数据搬迁窗口，不能在默认分支直接切换。

现状：README 第 140 行自己写明，面向较广受众开放注册前应先迁 Postgres。限流是进程内内存实现（`src/security/rateLimit.ts`），重启即清零、多副本失效，`release-checklist.md` 第 37 行已列为未完成。

做什么：`.env.example` 第 44-48 行已经写明"只改 DATABASE_URL 不够，schema 与迁移历史必须转换并测试"。迁移时同步把限流换成共享存储（Redis 或托管 KV）。注意 P0-1 的重置密码限流也依赖这一项才能在多实例下真正生效。

估算：3-4 人天，含迁移与全量回归。

### P3-2 语言统一与外部连接验收

**策略已定（2026-08-01）**：产品主语言为中文，见 `docs/language-policy.md`。登录页已改中文；引导/免责/法律页本就是中文。Web 计划/目标/设置/教练页英文文案按页替换，暂不引入 i18n 框架。

外部连接：`npm run connections:check` 列出 SMTP、飞书 OAuth、错误 webhook、Redis 限流、异地备份等配置缺口；真实 COROS/餐食/模型/推送仍需人工点一次。

估算：统一语言 1-2 人天；连接验收 1 人天。

---

## 分阶段路线

### 里程碑 A：少量真实用户能完整用起来（剩余约 5-7 人天）

目标是"朋友注册后能独立走通全流程，出问题你能查到原因，且服务器不会被注册用户拿下"。不开放注册，邀请制。

1. ~~P0-0 stdio MCP 安全收敛~~ — 已完成
2. ~~P0-3 餐食菜单未配置时不展示~~ — 已完成
3. ~~P0-4 模型 Key 自配置成功率~~ — 已完成
4. P0-1 忘记密码
5. P0-2 引导与免责声明
6. P2-1 错误监控（脱敏）
7. P1-1 隐私政策与服务条款

### 里程碑 B：可以对外开放注册（约 8-10 人天，接在 A 后）

8. P3-1 Postgres + 共享限流
9. P2-3 飞书日历 OAuth 改造
10. P2-2 备份自动化与恢复演练

### 里程碑 C：iOS 上架（约 4-7 人天 + 审核周期）

11. P1-2 全部前置项与真机验收
12. P3-2 语言统一与外部连接验收

## 明确不在范围内

服务端托管模型 Key（已决策由用户自配置）、支付与订阅、多语言 i18n 框架、社交/分享、Android 发布、多区域部署。
