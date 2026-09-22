# SQLite 小规模生产化实施计划

日期：2026-08-04

对应设计：`docs/superpowers/specs/2026-08-04-sqlite-small-scale-production-design.md`

## 实施原则

- 不修改业务 schema、API 和客户端。
- 不把 PostgreSQL、Redis 或云厂商 SDK带入当前阶段。
- 复用现有 `data-backup.mjs` 与 `data-backup-prune.mjs`，把复杂度收进一个 Compose 备份接口。
- 先增加可验证行为，再改生产配置和文档。
- 不提交、不推送，由主代理检查并决定后续 Git 操作。

## Task 1：收紧备份文件权限

文件：

- `scripts/data-backup.mjs`
- `tests/scripts/dataBackup.test.ts`（新增或复用合适的测试文件）

步骤：

1. 为备份数据库、manifest 和异地副本显式设置 `0600`。
2. 保持 `VACUUM INTO`、manifest 格式和 `HBM_BACKUP_OFFSITE_DIR` 行为兼容。
3. 用临时 SQLite 数据库执行真实备份，断言 header、hash 和权限。

验收：

```bash
npx vitest run tests/scripts/dataBackup.test.ts
```

## Task 2：增加 Compose 一键备份任务

文件：

- `Dockerfile`
- `compose.production.yml`
- `scripts/docker-backup.sh`（新增）

步骤：

1. 将备份和清理脚本复制到生产 runner。
2. 新增 `backup` service，放在 `maintenance` profile 下。
3. 与 app 共享 `hbm-data:/data`，将 `${HBM_BACKUP_HOST_DIR:-./backups}` 绑定到 `/backups`。
4. backup service 只执行在线快照和保留期清理，不启动 Web、不执行迁移。
5. 保持非 root 运行；文档说明 Linux 主机备份目录应归 UID/GID `1001` 所有。
6. 不给 backup service 注入应用密钥、SMTP 密码等无关配置。

运维接口：

```bash
HBM_BACKUP_HOST_DIR=/srv/healthy-body-manager/backups \
docker compose -f compose.production.yml --profile maintenance run --rm backup
```

验收：

```bash
docker compose -f compose.production.yml config
```

如 Docker 可用，再执行真实容器备份 smoke test；否则明确记录未完成的容器级证据。

## Task 3：补齐 Linux 调度和恢复文档

文件：

- `docs/backup-and-recovery.md`
- `README.md`
- `.env.example`（仅在项目已有并适合放非敏感配置时修改）

步骤：

1. 写出首次创建主机备份目录和权限命令。
2. 写出手动备份命令。
3. 提供 cron 或 systemd timer 示例，明确工作目录和绝对路径。
4. 说明主机目录仍需同步到另一故障域，并推荐加密传输/存储。
5. 写出停止应用、校验、恢复、重启和健康检查的完整流程。
6. 说明 `SETTINGS_ENCRYPTION_KEY` 的独立保管要求。

验收：所有命令与实际 Compose service、profile、环境变量名称一致。

## Task 4：回归验证

执行：

```bash
npx vitest run tests/scripts/dataStorage.test.ts tests/scripts/dataBackup.test.ts
npm test
npm run build
docker compose -f compose.production.yml config
git diff --check
```

检查：

- `git status --short` 只包含本计划授权的文件，以及任务开始前已有的未跟踪研究文档。
- 没有修改 Prisma schema 或 migrations。
- 没有引入 PostgreSQL、Redis 或新的云厂商依赖。
- 没有提交或推送。

## 主代理最终验收

主代理必须重新检查完整 diff，并至少重跑聚焦测试和 Compose 配置解析。若容器 smoke test 因本机 Docker 不可用而未执行，最终汇报必须明确该证据缺口，不能用静态测试代替。
