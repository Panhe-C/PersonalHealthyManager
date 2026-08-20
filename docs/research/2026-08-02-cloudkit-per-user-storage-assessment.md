# HealthyBodyManager 能否把每个用户的数据放进其个人 iCloud / CloudKit

> 核对日期：2026-08-02。本文仅依据当前仓库和 Apple 官方资料。结论以 App Store 上架为边界；企业内部分发或不上架并不会自动消除 Apple Developer Program 对 HealthKit 数据的约束，仍需单独审查协议。

## 结论

**不建议、也不应把 HealthyBodyManager 全量迁到每个用户的 CloudKit private database。**

决定性原因不是技术，而是 Apple 当前 App Review Guideline 5.1.3(ii) 明确规定：使用健康、健身和医疗数据的 App“不得将个人健康信息存储在 iCloud”。HBM 当前会从 HealthKit 读取并在数据库保存睡眠、HRV、静息心率、身体资料等信息，还会据此生成训练和恢复计划；这些数据及其健康推断都不应写进 CloudKit。[Apple App Review Guidelines 5.1.3](https://developer.apple.com/app-store/review/guidelines/)

推荐架构是：

```text
Apple Health / HealthKit
  └─ 原始 Apple 健康数据留在系统 HealthKit store
       └─ 用户明确授权后，App 读取必要的最少字段
            └─ HBM 服务端 PostgreSQL：账号、必要健康副本、计划、Agent、跨平台能力

iOS 本地缓存
  └─ 离线 UI / 同步游标 / 临时状态

CloudKit
  └─ 当前不进入主数据链；未来最多存严格非健康的轻量偏好
```

如果目标是“用户自己掌控数据”，更合适的方向是强化**可移植导出、删除、加密备份和最小化服务端留存**，而不是把健康数据库换成 iCloud。

## 1. CloudKit private database 技术上是什么

Apple 对 private database 的定义符合“一人一库”的直觉：

- 只有设备存在有效 iCloud/Apple Account 时才能使用；没有账号时，对 private database 的操作会报错；
- 默认只有该用户能访问、拥有并修改其中内容；
- private database 内容不在开发者门户中可见；
- 存储占用计入用户自己的 iCloud quota，满额时会返回 quota error。

这些边界见 [CKContainer.privateCloudDatabase](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase) 和 [CloudKit JS quota error](https://developer.apple.com/documentation/cloudkitjs/cloudkit.ckerror/quota_exceeded)。因此 CloudKit 可以降低开发者托管每个用户数据的存储责任，但也把可用性绑定到用户的 iCloud 登录、容量和账号状态。

CloudKit 不是“开发者可以后台遍历的托管 PostgreSQL”。它是 record/zone/sync 模型；Apple 也说明底层 `CKDatabase` 路径需要应用自己处理抓取、发送、冲突、账号变化、change token 和通知等问题。[Deciding whether CloudKit is right for your app](https://developer.apple.com/documentation/cloudkit/deciding-whether-cloudkit-is-right-for-your-app)

## 2. Web 可以访问，但不能无条件替代 HBM 后端

CloudKit JS 可以让 Web App 访问与 iOS/macOS App 相同的 public/private database，但前提是已有 CloudKit App/container、启用 Web Services，并让用户完成 iCloud 身份认证。[CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)

认证边界很关键：

- Web 访问用户 private database 需要 API token 和用户的 CloudKit web auth token；
- server-to-server key 只允许服务器以开发者身份访问 **public database**，不能让 HBM 后台管理员直接读取所有用户的 private database；
- Web 用户因此必须有 Apple Account 并维持 CloudKit 会话。

Apple 的 Web Services 文档明确把 server-to-server key 限定在 public database。[CloudKit Web Services：Composing Requests](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html)

这与 HBM 当前架构不匹配。现在 Web 和 Expo App 都通过统一 `/api/v1`、email/password、Bearer/cookie session 访问 Next.js 服务；服务端的 Agent、自动任务、COROS/飞书 OAuth 和计划生成会主动读取同一个 Prisma 数据库。若改成 private CloudKit：

- 账号体系要改成 Apple/iCloud 身份或再维护一套身份映射；
- 服务端无法用一个管理员凭据读取所有 private databases；
- Agent 请求和后台 automation 需要持续维护每个用户的 CloudKit web auth；
- Android/没有 iCloud 的用户会失去主存储；
- Prisma 的关系、事务、唯一约束和 migration 要重写为 CKRecord/zone/sync/conflict 模型。

因此“让 Web 也接 CloudKit JS”在技术上可做，但不是把 `DATABASE_URL` 换掉，而是一次完整的数据层、身份层和后台任务重构。

## 3. 最关键的上架限制：个人健康信息不能写入 iCloud

Apple 当前 App Review Guideline 5.1.3 针对健康、健身和医疗数据要求：

- HealthKit 等来源的数据不得用于广告、营销或无关数据挖掘；
- 必须披露从设备收集的具体健康数据；
- App 不得把个人健康信息存储在 iCloud。

[Apple App Review Guidelines 5.1.3](https://developer.apple.com/app-store/review/guidelines/) 是这里的直接决策依据。加密、private database 或“配额属于用户”都没有出现在该禁令的例外中，因此不能用“CloudKit private 是私有的”来绕过。

对 HBM，应按健康信息处理的至少包括：

| 当前数据 | 仓库模型/流程 | CloudKit 判断 |
| --- | --- | --- |
| 身高、体重、体脂、性别、静息心率、伤病 | `BodyProfile` | 不写 iCloud |
| 活动、训练负荷、心率 | `ActivityRecord` | 不写 iCloud |
| 睡眠阶段/时长 | `SleepRecord` | 不写 iCloud |
| HRV、恢复、压力与静息心率 | `RecoveryRecord` | 不写 iCloud |
| 基于上述数据生成的训练/营养/恢复计划 | `Plan`、`TrainingTask`、`PlanAdjustment` | 属于健康管理推断，保守按个人健康信息处理 |
| 包含健康上下文的 Agent 对话与记忆 | `AgentMessage`、`AgentMemory` | 很可能含健康信息，不写 iCloud |

只把 raw HealthKit samples 留在 HealthKit、把“汇总后的 HRV/睡眠”写进 CloudKit，也不能可靠规避该规则：汇总数据仍是可识别用户的个人健康信息。

## 4. Apple 自己的 Health iCloud 同步不是 App 写 CloudKit

这里看起来有矛盾，但实际是两条不同数据路径：

1. **Apple Health/HealthKit 路径**：HealthKit store 位于设备并由系统保护；Apple 可以按用户的系统设置，在同一 Apple Account 的设备间同步 Health 数据。Apple 说明该数据在传输和 iCloud 存储期间加密，满足条件时使用端到端加密。[HealthKit：Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy) [Apple Support：Manage Health data](https://support.apple.com/en-us/108779)
2. **第三方 App CloudKit 路径**：App 主动把自己的 CKRecord 写进 CloudKit container。App Review Guideline 5.1.3(ii) 禁止 App 用这条路径存个人健康信息。

HealthKit 还会在受支持的 Apple 设备间自动同步其 store。[About the HealthKit framework](https://developer.apple.com/documentation/healthkit/about-the-healthkit-framework) 这不赋予第三方 App 把读出的 HealthKit 数据再复制到 CloudKit 的权限。

所以正确表述是：**用户可以让 Apple Health 自身通过 iCloud 同步；HBM 不应把 HealthKit 数据另存为自己的 CloudKit records。**

## 5. CloudKit sharing 也不能解决健康数据问题

CloudKit 支持用户把 private database 中的 custom zone 或 record hierarchy 通过 `CKShare` 分享给其他 iCloud 用户。原 owner 仍拥有记录，参与者只在 shared database 中看到该 share 的视图；参与者必须有有效 iCloud 账号，并可被授予只读或读写权限。[Apple：Shared Records](https://developer.apple.com/documentation/cloudkit/shared-records)

它适合协作文档、清单等数据，但不会把健康信息的 iCloud 禁令变成允许。未来即使要做“把训练计划分享给教练”，也应先完成 Apple 审核/法律合规评估，而不是直接用 CKShare 分享包含健康指标的记录。

## 6. 三种方案比较

| 方案 | 合规与产品判断 | 对 HBM 的影响 |
| --- | --- | --- |
| 全量 CloudKit private DB | **不适合**；核心健康数据触及明确禁令 | 重写数据/认证/后台任务，Web 与无 Apple Account 用户受限，仍不能合法放健康数据 |
| 混合：健康数据中心库，非健康偏好 CloudKit | **技术上可行，但当前不值得** | 可存主题、排序等纯 UI 偏好；同时维护两套同步/删除/导出语义，收益很小 |
| HealthKit + 中央 PostgreSQL + 本地缓存 | **推荐** | 保留现有 Web、Agent、自动任务和第三方集成；把 Apple 原始健康数据留在 HealthKit，仅上传明确同意且产品必需的数据 |

这里的“中央 PostgreSQL”不是说可以无限制收集健康数据。仍需明确同意、最小化字段、传输/静态加密、访问控制、保留期、用户导出/删除以及准确的 App Privacy 披露；只是 Apple 的规则没有把合规的外部数据库等同于被禁止的 iCloud 存储。

## 7. 对当前 HBM 的具体建议

### 推荐主方案

1. HealthKit 继续作为 Apple 健康原始数据源；不尝试把原始 samples 全量复制到 HBM；
2. 用户开启同步时，只上传计划/Agent 真正需要的最少字段和时间范围；
3. 服务端 PostgreSQL 保存跨 Web/iOS、Agent、自动任务所需的业务数据；
4. iOS 本地保留短期缓存和同步游标，让网络故障时仍可显示最近数据；
5. 设置中明确显示“哪些 HealthKit 类型会上传到 HBM 服务端、用途、保留多久、如何删除”；
6. 账户导出和删除覆盖服务端健康副本、计划、Agent 内容及第三方连接；
7. 不启用任何自动将健康数据或健康导出文件写入 iCloud Drive/CloudKit 的功能。

### CloudKit 可以保留的极窄候选

如果未来确有 Apple-only 多设备体验，可以单独评估仅同步严格非健康的 UI 偏好，例如主题、排序、是否折叠某个面板。不要存：健康字段、健康计划、健康 Agent 对话、凭据、会话 token 或包含健康内容的导出文件。

即使只存偏好，也要处理未登录 iCloud、quota exceeded、账号切换、Web auth、删除和冲突；在当前产品已有中央账号/数据库的情况下，不建议仅为几个偏好引入第二套云同步。

### 如果坚持“数据只归用户，不进中央库”

应设计成一个不同产品模式：**HealthKit + 设备本地加密数据库 + 设备端推理/用户主动调用模型**。这会牺牲或重做 Web、服务端 Agent、定时自动化、COROS/飞书后台集成和跨平台同步。CloudKit 仍不能承载其中的个人健康数据，因此它不是该模式的健康同步层。

## 最终建议

选择 **“HealthKit/本地设备 + 中央 PostgreSQL”的最小化混合方案**，但这里的“混合”不包含用 CloudKit 存健康信息。CloudKit 暂不进入 HBM 主架构；将来只有明确的非健康同步场景时再单独评估。

## 主要 Apple 一手来源

- [App Store Review Guidelines 5.1.3](https://developer.apple.com/app-store/review/guidelines/)
- [HealthKit：Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [About the HealthKit framework](https://developer.apple.com/documentation/healthkit/about-the-healthkit-framework)
- [Apple Support：Manage Health data](https://support.apple.com/en-us/108779)
- [CloudKit：Deciding whether CloudKit is right for your app](https://developer.apple.com/documentation/cloudkit/deciding-whether-cloudkit-is-right-for-your-app)
- [CKContainer.privateCloudDatabase](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase)
- [CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)
- [CloudKit Web Services：Composing Requests](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html)
- [CloudKit：Shared Records](https://developer.apple.com/documentation/cloudkit/shared-records)
