# 发布检查清单

最后更新：2026-07-19

## 已完成的代码基线

- [x] 真实 owner 账号配置、密码修改、会话失效和带密码确认的账户删除
- [x] 个人数据导出，排除密码、会话令牌和明文密钥
- [x] Web 与移动端核心资料、目标、计划、训练反馈和设置流程
- [x] HealthKit 配置插件、授权读取、同步接口和 iOS arm64 模拟器构建
- [x] 登录与 Agent 请求限流、安全响应头、数据库健康检查
- [x] SQLite 校验备份与可回滚恢复脚本
- [x] GitHub Actions：安装、Prisma、Web/移动测试、类型检查和生产构建
- [x] macOS LaunchAgent 配置生成与安装脚本（尚未在用户系统启用）
- [x] 隐私说明草案与数据删除说明

## 发布前阻塞项

- [ ] 填写 `apps/mobile/app.json` 的 EAS Project ID，确认最终 bundle identifier 和应用名称
- [ ] 配置 Apple Developer Team、签名证书、Provisioning Profile、HealthKit 与 Push Notifications capability
- [ ] 在真实 iPhone 上安装 Development Build，逐项验证 HealthKit 授权、后台读取、通知权限和推送到达
- [ ] 创建并验证 EAS development / preview / production 构建及 APNs 凭据
- [ ] 配置生产域名、HTTPS、数据库持久化、迁移策略和环境密钥轮换
- [ ] 使用真实 owner 邮箱和强密码完成生产初始化，确认不运行 demo seed
- [ ] 配置并实际安装自动任务服务，验证重启、日志、失败重试和通知去重
- [ ] 补齐飞书日历事件删除权限，实测创建、更新、取消和账户删除后的外部事件处理
- [ ] 对 COROS、餐食菜单、模型服务商进行真实连接验收，并确认最小权限
- [ ] 完成备份恢复演练，并制定在线数据与离线备份的保留期限
- [ ] 将隐私说明中的运营主体、联系邮箱、生效日期、公开 URL 和部署地域补全
- [ ] 完成 App Store 隐私问卷、HealthKit 用途说明、应用截图、支持 URL 和审核备注

## 安全与依赖专项

- [ ] 将当前 Expo SDK 52 升级到受支持的新 SDK，并重新验证 HealthKit 原生构建。2026-07-19 的 `npm audit --omit=dev` 报告 0 critical、17 high、7 moderate；高风险项主要位于 Expo CLI/config/build 依赖链。自动修复要求跨大版本升级到 Expo 57，不应直接使用 `npm audit fix --force`。
- [ ] 生产若扩展为多实例或 serverless，将当前进程内限流替换为共享存储限流（例如 Redis/托管 KV）。
- [ ] 对公开部署执行依赖审计、渗透测试、日志脱敏检查和恢复演练。

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
