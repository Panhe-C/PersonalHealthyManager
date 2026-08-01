# 发布检查清单

最后更新：2026-08-01

## 已完成的代码基线

- [x] 真实 owner 账号配置、密码修改、会话失效和带密码确认的账户删除
- [x] 邮件重置密码：防枚举响应、按 IP 与邮箱双维度限流、重置后吊销全部会话
- [x] 首次登录引导与健康免责声明：四步引导 + 计划页/教练回复常驻脚注 + 首次进入教练页一次性确认
- [x] 公开隐私政策与服务条款页面（`/privacy`、`/terms`）+ 注册同意勾选 + 同意版本落库 + release:check 门禁
- [x] 结构化日志与脱敏错误上报（可选 webhook）
- [x] 备份定时/异地/保留期 + 恢复演练脚本
- [x] 飞书日历按用户 OAuth 骨架（凭据就绪后可联调）
- [x] 限流存储抽象（内存默认 / Upstash Redis）+ Postgres 迁移文档
- [x] 语言策略（中文为主）+ 外部连接验收脚本
- [x] 个人数据导出，排除密码、会话令牌和明文密钥
- [x] Web 与移动端核心资料、目标、计划、训练反馈和设置流程
- [x] HealthKit 配置插件、授权读取、同步接口和 iOS arm64 模拟器构建
- [x] Expo SDK 53 升级、依赖对齐、Expo Doctor 检查和 iOS 原生全量构建
- [x] 登录与 Agent 请求限流、安全响应头、数据库健康检查
- [x] SQLite 校验备份与可回滚恢复脚本
- [x] 单实例生产容器、SQLite 持久化卷、启动迁移、健康检查和容器内在线备份
- [x] GitHub Actions：安装、Prisma、Web/移动测试、类型检查和生产构建
- [x] macOS LaunchAgent 配置生成、安装并完成重启、日志和任务执行验证
- [x] 隐私说明草案与数据删除说明

## 发布前阻塞项

- [ ] 填写 `apps/mobile/app.json` 的 EAS Project ID，确认最终 bundle identifier 和应用名称
- [ ] 配置 Apple Developer Team、签名证书、Provisioning Profile、HealthKit 与 Push Notifications capability
- [ ] 在真实 iPhone 上安装 Development Build，逐项验证 HealthKit 授权、后台读取、通知权限和推送到达
- [ ] 创建并验证 EAS development / preview / production 构建及 APNs 凭据
- [ ] 配置生产域名、HTTPS、数据库持久化、迁移策略和环境密钥轮换
- [ ] 使用真实 owner 邮箱和强密码完成生产初始化，确认不运行 demo seed
- [ ] 配置并实际安装自动任务服务，验证重启、日志、失败重试和通知去重
- [ ] 飞书日历写回目前只服务 `HBM_LARK_CALENDAR_ACCOUNT_EMAIL` 指定的单个账号（未配置则整体禁用）。多用户开放前必须改为按用户 OAuth，并实测创建、更新、取消和账户删除后的外部事件处理
- [ ] 对 COROS、餐食菜单、模型服务商进行真实连接验收，并确认最小权限
- [ ] 完成备份恢复演练，并制定在线数据与离线备份的保留期限
- [ ] 将隐私说明中的运营主体、联系邮箱、生效日期、公开 URL 和部署地域补全（现由 `HBM_OPERATOR_NAME`/`HBM_PRIVACY_EMAIL`/`HBM_POLICY_EFFECTIVE_DATE`/`HBM_DEPLOYMENT_REGION`/`HBM_PUBLIC_BASE_URL` 环境变量提供，`release:check` 门禁已就位）
- [ ] 完成 App Store 隐私问卷、HealthKit 用途说明、应用截图、支持 URL 和审核备注

## 安全与依赖专项

- [x] 已将 Expo SDK 52 升级到 SDK 53，并重新验证 HealthKit 原生构建。2026-07-20 的 `npm audit --omit=dev` 报告 0 critical、0 high、18 moderate；剩余项主要位于 Expo CLI/config/build、PostCSS 和 UUID 依赖链。自动修复要求跨大版本升级到 Expo 57，不直接使用 `npm audit fix --force`。本机 Xcode 16.2 先保持 SDK 53，生产 EAS 构建使用最新镜像；后续升级 Xcode 后再按 SDK 顺序继续升级。
- [ ] 生产若扩展为多实例或 serverless，配置 `HBM_RATE_LIMIT_REDIS_URL` / `HBM_RATE_LIMIT_REDIS_TOKEN`（已实现 Upstash HTTP 后端）。
- [ ] 对公开部署执行依赖审计、渗透测试、日志脱敏检查和恢复演练（`npm run data:drill`）。
- [ ] 完成备份恢复演练记录，并确认 `HBM_BACKUP_OFFSITE_DIR` 与保留期限。
- [ ] 配置 Feishu 应用凭据并实测按用户日历 OAuth 的创建/更新/取消与账户删除后的外部事件。
- [ ] 按 `docs/postgres-migration.md` 在开放广域注册前完成 Postgres 切换。
- [ ] 按 `docs/language-policy.md` 将剩余 Web 英文页面改为中文。
- [ ] 填写 EAS Project ID / Bundle ID / Apple Team，并用 `apps/mobile/app.config.js` + `eas.json` 打出真机构建。

## 验收命令

```bash
npm test
npx tsc --noEmit -p apps/mobile/tsconfig.json
npm test --workspace @hbm/mobile
npm run build
npm run release:check
```

`release:check` 会读取发布环境变量和隐私说明，明确报告 EAS Project ID、HTTPS API、Bundle ID、Apple Team ID 与隐私元数据是否齐全。它在缺失项存在时返回非零状态，适合作为正式构建前的本地或 CI 门禁。

iOS 原生构建、真机签名和外部服务调用必须单独验收；模拟器或单元测试通过不能替代这些证据。
