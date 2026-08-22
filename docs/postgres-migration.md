# Postgres 迁移准备

当前默认数据库是 SQLite（`prisma/schema.prisma` 的 `provider = "sqlite"`）。面向较广受众开放注册前应迁到 Postgres。`docker-compose.yml` 已提供可选的 `postgres:16` 服务。

## 为什么不能只改 DATABASE_URL

SQLite 与 Postgres 的类型、自增、JSON、日期时间字面量不同。现有 `prisma/migrations/*` 是按 SQLite 生成的；直接把 `DATABASE_URL` 指到 Postgres 会让 `migrate deploy` 失败或产生不兼容的 schema。

## 推荐步骤

1. 起本地 Postgres：`docker compose up -d postgres`
2. 备份当前 SQLite：`npm run data:backup`
3. 新建分支，将 `prisma/schema.prisma` 的 `provider` 改为 `postgresql`
4. 用 `prisma migrate diff` 从空 Postgres 生成一份新的初始迁移（不要直接重放 SQLite 迁移历史）
5. 导出 SQLite 数据并导入 Postgres（可用 `prisma db execute` + 自定义脚本，或第三方工具）
6. 全量跑 `npm test`、`npm run build`、移动端测试
7. 生产切换：先停写 → 最终备份 → 导入 → 切 `DATABASE_URL` → 验证 `/api/health`

## 限流

多实例 Postgres 部署时，进程内限流会失效。设置：

```bash
HBM_RATE_LIMIT_REDIS_URL="https://xxxxx.upstash.io"
HBM_RATE_LIMIT_REDIS_TOKEN="..."
```

即可启用 Upstash 兼容的 HTTP Redis 限流后端（见 `src/security/rateLimitStore.ts`）。未配置时仍用进程内内存。

## 验收

```bash
npm run db:postgres:check
npm test
npm run build
```

`db:postgres:check` 只检查环境与 compose 服务是否就绪，不会改写 schema。
