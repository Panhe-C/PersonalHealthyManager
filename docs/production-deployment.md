# 正式域名部署

本仓库的唯一正式 origin 是 `https://www.cbhdev.xyz`。Web 的
`HBM_APP_BASE_URL`、`HBM_PUBLIC_BASE_URL` 与 iOS production build 的
`EXPO_PUBLIC_API_BASE_URL` 必须完全等于该值（不带尾部 `/`）。本地开发仍使用
`http://localhost:3000` 或真机可访问的局域网地址，测试不请求正式域名。

## 上线前外部条件

- 域名 DNS 指向应用服务器；中国大陆公网服务按实际主体完成 ICP 备案。代码与
  Caddy 配置不能代替备案审批。
- 轻量应用服务器的公网防火墙只开放 `22/tcp`、`80/tcp`、`443/tcp`；关闭
  `3000/tcp`。Compose 默认只把应用绑定到 `127.0.0.1:3000`。
- 将 `deploy/Caddyfile` 安装为 `/etc/caddy/Caddyfile`，运行
  `caddy validate --config /etc/caddy/Caddyfile` 后 reload。Caddy 为 `www` 域名
  终止 HTTPS，把根域名重定向到唯一 origin，并反代本机应用。
- 在服务器 `.env` 中注入独立的高熵 `SESSION_SECRET`、
  `SETTINGS_ENCRYPTION_KEY`。不要提交任何 secret。
- 由实际运营者填写并复核 `HBM_OPERATOR_NAME`、`HBM_PRIVACY_EMAIL`、
  `HBM_POLICY_EFFECTIVE_DATE`、`HBM_DEPLOYMENT_REGION`。仓库不猜测法律主体。

## 注册与邮件策略

生产 Compose 默认 `HBM_REGISTRATION_ENABLED=false` 和
`HBM_EMAIL_TRANSPORT=console`。这是一套可上线的邀请制策略：已初始化 owner
仍可登录，自助注册入口隐藏，注册 API 返回 `403 registration_disabled`。
console 邮件不会投递到公网邮箱，因此忘记密码、重新发送验证邮件等邮件流程也不应
被当作已完成验收；owner 必须妥善保管凭据。

直接注册不依赖邮件服务。开放注册可继续使用 `console` transport；此时忘记密码邮件
只写入服务器日志，不会真实投递。需要可用的密码找回功能时再配置 SMTP：

```dotenv
HBM_REGISTRATION_ENABLED=true
HBM_EMAIL_TRANSPORT=smtp
HBM_EMAIL_FROM=Healthy Body Manager <no-reply@cbhdev.xyz>
HBM_SMTP_HOST=smtp.example.com
HBM_SMTP_PORT=587
HBM_SMTP_SECURE=false
HBM_SMTP_USER=replace-with-real-user
HBM_SMTP_PASSWORD=replace-with-secret
```

`npm run release:web` 会要求 canonical URL、隐私元数据和部署地域通过；选择 SMTP
transport 时还会校验上述 SMTP 配置。实际发信到达、退信、SPF/DKIM/DMARC 仍需在
邮件供应商与真实邮箱中验收。iOS build 同时设置
`EXPO_PUBLIC_REGISTRATION_ENABLED=true`；邀请制 build 设置为 `false`。

## 独立发布门禁

```bash
npm run release:web
npm run release:mobile
npm run release:check
```

`release:web` 只检查 Web/服务器配置；`release:mobile` 只检查 EAS UUID、canonical
HTTPS API、bundle ID、Apple Team ID 与移动端注册开关；`release:check` 为兼容旧
流程而依次运行两者。Apple Developer Team、签名、EAS production build、App Store
Connect 与真机能力必须在 Apple/Expo 外部系统单独验收。

## 部署与备份

```bash
docker compose --env-file .env -f compose.production.yml up -d --build app
docker compose --env-file .env -f compose.production.yml ps
curl --fail http://127.0.0.1:3000/api/health
curl --fail https://www.cbhdev.xyz/api/health
```

只运行一个 app 实例，不为 SQLite 引入 Redis 或多副本。OSS 备份按
[备份与恢复](backup-and-recovery.md)配置：Bucket 保持私有、凭据最小权限、上传后
回读校验，并定期做隔离恢复演练。OSS 上传成功不等于恢复已验证。
