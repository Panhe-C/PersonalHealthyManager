# iOS App · M5 打磨上架 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M5 阶段，依赖 M0–M4 完成）

## 这份清单的范围

M5 目标：**补齐 P2 功能（设置/MCP）、做发布质量打磨、备齐合规材料，经 TestFlight 内测后正式上架 App Store**。

**前置依赖**：M0–M4 完成（功能完整 + HealthKit 等原生价值就位）。

### 关键现状（已盘点）

- **设置端点**：`GET/POST /api/settings`（`loadUserSettings`/`saveUserSettings`，含模型 provider/key、MCP 连接配置）。可纳入 v1。
- **MCP OAuth 是浏览器重定向流程，且 callback 不依赖 cookie**：
  - `GET /api/settings/mcp/oauth/start?connection=` → 302 跳到授权页。
  - `GET /api/settings/mcp/oauth/callback` → 用 `state` 解析用户（注释明确：COROS 要求 redirect_uri 用 `127.0.0.1` 回环，callback 落在不同 origin，无法用 session cookie，故靠 `state` 找用户），再重定向回 `/settings`。
  - **原生端要害**：这套「跳浏览器 + 回跳」必须用 **ASWebAuthenticationSession**（`expo-web-browser` 的 `openAuthSessionAsync`）+ Deep Link 回 App，不能简单内嵌。
- API key 在后端加密存储（`src/settings/crypto.ts`），客户端只填不读明文（现有 `apiKeyHint`）。

执行顺序：T1 设置/MCP → T2 OAuth 原生适配 → T3 质量打磨 → T4 合规材料 → T5 TestFlight → T6 提审上架。

---

## T1 设置页（含模型/MCP 配置）

### 步骤

1. `/api/v1/settings`（GET/POST 薄转发）。契约 `settingsSchema`（注意 key 只写不回明文，展示 `apiKeyHint`）。
2. 设置页：
   - 模型 provider / modelName / baseUrl / API key（输入即存，展示 hint）。
   - MCP 连接列表（COROS、食堂菜单等）：连接状态 + 「连接/断开」入口（连接走 T2 OAuth）。
   - 账号：登出、时区。
3. 数据 hooks 沿用既有范式（`useSettingsQuery`/`useSaveSettingsMutation`）。

### 验收（T1）

- 可查看/修改模型与 MCP 配置；API key 保存后仅显示 hint。

---

## T2 MCP OAuth 原生适配（要害项）

### 步骤

1. **发起授权**：客户端用 `expo-web-browser` 的 `openAuthSessionAsync(startUrl, redirectUrl)` 打开 `/api/v1/settings/mcp/oauth/start?connection=...`（带 Bearer，或后端用 state 关联用户——见下）。
2. **回跳处理**：
   - 因现有 callback 走 `state` 解析用户并重定向到 web `/settings`，原生需新增/调整：让 OAuth 流程支持回跳到 App 的 Deep Link（如 `hbm://oauth/callback`）而非 web `/settings`。
   - 方案：`start` 端点接受一个 `returnTo`（App deep link），落进 OAuth `state`；`callback` 成功后按 `state.returnOrigin/returnTo` 重定向到 App scheme。需小心校验 `returnTo` 白名单防开放重定向。
3. **回到 App 后**：刷新设置页连接状态（invalidate `["settings"]`）。
4. **回环地址限制**：COROS 要求 `127.0.0.1` redirect_uri 的约束在移动端如何满足，需实测（可能需后端中转 callback 再跳 App scheme）。

### 验收（T2）

- 真机上完成一次 MCP（如 COROS）OAuth 连接：跳系统授权 → 回到 App → 设置页显示已连接。

> 注：本项涉及后端 OAuth 流程对「App 回跳」的小幅改造，是 M5 唯一的后端改动点，需在 spec 风险项 #1 基础上落实方案。

---

## T3 发布质量打磨

### 步骤

1. **图标/启动屏**：正式 App 图标（各尺寸）、Splash。
2. **空态/错误/弱网**：全 App 三态覆盖审查；离线只读体验确认。
3. **可访问性**：动态字体、VoiceOver 标签、点击区域 ≥44pt、对比度。
4. **性能**：列表虚拟化、图表渲染、冷启动时间。
5. **崩溃/日志**：接入 Sentry 或等价，捕获线上崩溃。
6. **设置内 API base 切换**：dev/staging/prod，便于内测。

### 验收（T3）

- 走查清单通过，无明显崩溃/卡顿，弱网可用。

---

## T4 合规与上架材料

### 步骤

1. **隐私政策**：编写并托管（HealthKit/健康数据用途必须明确）。
2. **App 隐私清单**（PrivacyInfo.xcprivacy）+ App Store「隐私营养标签」：声明采集的数据类型（健康、账号）。
3. **HealthKit 用途说明**：`NSHealthShareUsageDescription` 文案符合实际用途。
4. **账号删除入口**：Apple 要求可在 App 内发起账号删除（需后端 `DELETE /api/v1/account` + 客户端入口）。
5. **App Store 素材**：名称、副标题、关键词、截图（各机型）、描述、分级。
6. **演示账号**：给审核员可登录的测试账号 + 说明（涉及健康数据/AI 教练，需说明数据来源）。

### 验收（T4）

- 隐私政策上线、隐私清单完整、账号删除可用、商店素材齐备。

---

## T5 TestFlight 内测

### 步骤

1. EAS Build 出 production-like 构建，上传 App Store Connect。
2. 内部测试（自己 + 朋友），跑核心用户旅程：登录→生成计划→打卡→看板→Agent→HealthKit 同步→推送。
3. 收集反馈，修关键 bug，迭代构建。

### 验收（T5）

- 至少一个稳定 TestFlight 构建，核心旅程无阻断性问题。

---

## T6 提交审核与上架

### 步骤

1. 填写版本信息、上传最终构建、关联隐私材料与演示账号。
2. 提交审核，跟进 Apple 反馈（常见：4.2 最小功能、5.1.1 数据收集说明、HealthKit 用途、账号删除）。
3. 针对反馈快速修复重提（预留 1–2 轮往返缓冲）。
4. 通过后发布（手动/自动）。

### 验收（T6）

- App 通过审核并在 App Store 上架。

---

## M5 总验收

- 设置/MCP（含原生 OAuth）可用。
- 质量、合规、隐私、账号删除齐备。
- TestFlight 内测通过，App Store 审核通过并上架。

## 开放问题（执行前需定）

1. **OAuth App 回跳方案**：后端中转 callback 再跳 App scheme vs 直接让 callback 支持 App deep link（涉及 `state.returnTo` 白名单）。需结合 COROS 的 `127.0.0.1` 约束实测确定。
2. **崩溃监控选型**：Sentry vs 其他。默认 Sentry。
3. **账号删除范围**：软删 vs 物理删 + 数据导出。默认提供物理删除入口（满足 Apple 要求），保留导出为可选。
4. **发布节奏**：先 TestFlight 长期内测稳定后再上架 vs 尽快上架小步迭代。默认先内测 1–2 周再提审。
