# iOS App · M4 原生能力增强 实施清单

日期：2026-06-29
状态：待执行（对应 `2026-06-29-ios-app-design.md` 的 M4 阶段，依赖 M0–M3 完成）

## 这份清单的范围

M4 目标：**加上 Web 拿不到的原生能力，做出差异化体验，并满足 App Store「实质原生价值」审核要求** —— HealthKit、APNs 推送、后台同步、Deep Link。

**为什么 M4 是上架前置**：纯转发 Web 内容的 App 易被 Apple 判「最小功能/套壳」拒审（Guideline 4.2）。HealthKit 是最自然的原生价值证据，**必须在 M5 提审前落地**。

**前置依赖**：M0–M3 完成（App 已是功能完整的 Web 等价客户端）。

**工程前提**：HealthKit / 推送 / 后台任务都需要原生模块与权限配置，Expo **managed 工作流需用 config plugin 或转 prebuild/bare**。建议本阶段起切到 **Expo prebuild（CNG）**，保留 JS 开发体验同时能改原生配置。

### 关键现状（已盘点）

- **COROS 同步端点**：`POST /api/sync/coros` —— 带 `{activities|sleep|recovery}` payload 走 `importCorosPayload`，否则 `syncCorosFromSettings`。**HealthKit 数据可复用这条 import 路径**（构造同形 payload，`source` 标 `healthkit`）。
- 数据模型 `ActivityRecord/SleepRecord/RecoveryRecord` 均有 `source` + `@@unique([userId, source, ...])`，天然支持多来源并存与幂等 upsert。

执行顺序：T0 切 prebuild → T1 HealthKit → T2 推送 → T3 后台同步 → T4 Deep Link → T5 联调。

---

## T0 切换 Expo prebuild（原生工程前提）

### 步骤

1. `apps/mobile` 引入 prebuild（`expo prebuild`），生成 `ios/` 原生工程（纳入版本管理或保持 CNG 由 plugin 生成，二选一）。
2. 配置 `app.config.ts` 的 iOS 权限文案占位（HealthKit、通知）。
3. 确认 EAS Build 能出带原生模块的开发版（development build）装到真机。

### 验收（T0）

- development build 装真机可跑，原生模块可加载。

---

## T1 HealthKit 集成（上架前置）

### 步骤

1. **依赖与权限**：接入 HealthKit 库（`@kingstinct/react-native-healthkit` 或等价），配置 `NSHealthShareUsageDescription`、`com.apple.developer.healthkit` entitlement。
2. **读取范围**：活动（workouts/能量/距离/心率）、睡眠分析、静息心率/HRV。
3. **授权流**：App 内引导用户授权（HealthKit 权限对用户不透明，需 UI 解释用途）。
4. **映射 + 上报**：把 HealthKit 样本映射为 `POST /api/v1/sync/coros`（纳入 v1 的 sync 端点）可接受的 payload 形态，`source="healthkit"`：
   - workout → `ActivityRecord`
   - sleep analysis → `SleepRecord`（HealthKit sleep 是多段 asleep/awake/inBed，需聚合成单条按天的 SleepRecord：取最早 start、最晚 end、累计 duration）
   - HRV/restingHR → `RecoveryRecord`（HRV 是独立样本类型，与 COROS 字段口径不同，需单独取当天代表值如均值/首样）
   - 复用现有 `importCorosPayload` 的幂等 upsert（`@@unique(userId, source, sourceId/date)`），避免重复。
   - **映射表作为 T1 独立子任务产出**：先写「HealthKit 样本字段 ↔ ActivityRecord/SleepRecord/RecoveryRecord 字段」对齐表 + 单位换算（HealthKit 能量常为 kcal、距离为 m，确认与 COROS 入库单位一致），再写代码。
   - **`sourceId` 定义**：activity 用 HealthKit workout 的 `uuid` 作 `sourceId`；sleep/recovery 按天聚合，用日期字符串（如 `2026-06-29`）作唯一键，落在 `date` 字段，幂等键即 `@@unique([userId, source, date])`。不显式定义则幂等会失效或重复入库。
5. **触发时机**：手动「立即同步」按钮 + 后台任务（T3）。
6. **空数据/无授权**：友好降级提示，不阻塞其他功能。

### 验收（T1）

- 真机授权后，Apple Watch/iPhone 的活动/睡眠/心率数据进入后端，看板(M3)能看到 `source=healthkit` 的记录，重复同步不产生重复行。

---

## T2 推送通知（APNs）

### 步骤

1. **客户端**：用 `expo-notifications` 申请权限、取 Expo push token，注册到后端。
2. **后端**：
   - 新增 `PushToken` 表（userId、token、platform、createdAt）+ `POST /api/v1/push/register` 端点。
   - 推送发送封装（Expo Push API 或直连 APNs），在以下事件触发：训练提醒（按当天 task `scheduledStart`）、计划生成完成、Agent 高风险待确认/调整完成。
   - **定时任务承载方式需先定**：Next.js 本身不跑 cron。三选一——Vercel Cron（若部署 Vercel，免费档有限制）/ 外部 scheduler（如 cron-job.org、自建 worker）/ 独立 worker 进程。影响部署架构，列为开放问题或在本阶段开始前敲定。
3. **提醒调度**：训练提醒由服务端定时任务（见上）按用户时区在任务前 X 分钟推送。
4. **点击行为**：携带 deeplink payload（见 T4）。

### 验收（T2）

- 真机收到训练提醒推送；点击跳到对应任务。

---

## T3 后台同步

### 步骤

1. **客户端后台任务**：`expo-background-task`/`expo-task-manager` 注册周期任务，定期：拉 HealthKit 增量 → 上报；拉服务端增量（`?since=`）刷新本地缓存。
2. **服务端定时为主通道**：COROS/菜单同步与训练提醒由服务端 cron（部署平台的 scheduled job）按用户时区触发，不依赖 App 在前台。
3. **iOS 后台预算现实约束**：iOS 对后台任务执行有严格预算，App 长期不打开可能数天不触发 `expo-background-task`。**对「HealthKit 数据新鲜度」的预期需对齐**：服务端 cron 是主通道（处理 COROS/菜单/提醒），客户端后台任务只是补充（主要为了让用户打开 App 时数据较新）。HealthKit 只能在设备侧读，无法纯靠服务端 cron——接受其新鲜度受 iOS 调度限制。
4. **节流**：尊重 iOS 后台执行预算，失败重试与退避。

### 验收（T3）

- App 长时间未打开后再开，数据已被后台更新（或服务端侧已同步）。

---

## T4 Deep Link / 通用链接

### 步骤

1. 配置 URL scheme + （可选）Universal Links（关联域名 `apple-app-site-association`）。
2. expo-router 解析 deeplink 路由到目标屏：任务详情、某会话、某计划。
3. 推送 payload 带目标路由，点击直达。

### 验收（T4）

- 点推送/外部链接能直达 App 内对应页面。

---

## T5 端到端联调

### 步骤

1. 真机跑通：HealthKit 授权→同步→看板可见；收到训练提醒推送→点击直达任务；杀后台一段时间后数据自动更新。
2. 多来源数据一致性：healthkit 与 coros 数据并存、不冲突、不重复。

### 验收（T5）

- 原生能力闭环可用，且与既有 COROS/计划数据兼容。

---

## M4 总验收

- HealthKit 读取并入库（上架原生价值就位）。
- 训练提醒等推送可达、可点击直达。
- 后台同步生效，App 冷启动即见新数据。
- 数据多来源（healthkit/coros）幂等并存。
- 满足进入 M5（提审）的「实质原生功能」前提。

## 开放问题（执行前需定）

1. **HealthKit 是否替代部分 COROS**：两者数据重叠（心率/活动）。默认并存、按 source 区分，由用户选启用哪些来源；是否做去重合并策略待定。
2. **推送通道**：Expo Push（省事，经 Expo 服务器）vs 直连 APNs（自建证书、更可控）。默认 Expo Push。
3. **后台同步主体**：客户端后台任务 vs 全部交服务端 cron。默认「服务端 cron 为主 + 客户端拉 HealthKit 增量」（HealthKit 只能在设备侧读）。
4. **服务端 cron 承载方式**：Vercel Cron / 外部 scheduler / 独立 worker 三选一，需在 T2 开始前敲定（影响部署架构）。
5. **prebuild vs 继续 managed + config plugin**：默认 prebuild，工程更可控。
