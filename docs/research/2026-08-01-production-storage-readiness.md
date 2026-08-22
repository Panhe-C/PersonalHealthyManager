# HealthyBodyManager 正式上线需要准备哪些存储

> 核对日期：2026-08-01。本文基于当前 `feat/production-readiness` 分支源码与官方一手资料，讨论“面向公众、允许多用户注册”的正式上线；单人自托管可以采用更小的配置。

## 结论先行

正式上线最少需要三类持久化能力：

1. **一个托管 PostgreSQL，作为唯一业务主库；**
2. **一套独立、自动化且做过恢复演练的备份；**
3. **一个云端密钥管理位置，保存数据库密码、应用密钥和第三方凭据。**

如果应用部署为多实例或 serverless，再增加 **托管 Redis** 共享限流计数。当前产品没有图片、音频或附件上传，因此 **对象存储不是现阶段上线前置项**；以后增加文件功能时再引入。

| 存储 | 当前正式上线判断 | 保存什么 | 不应该保存什么 |
| --- | --- | --- | --- |
| 托管 PostgreSQL | 面向公众上线必需 | 账号、会话、健康数据、目标、计划、Agent 历史、推送 token、加密后的第三方凭据 | 图片/音频等大文件，限流短期计数 |
| 备份存储 | 必需 | PostgreSQL 快照、PITR/WAL、必要的独立逻辑备份和恢复记录 | 唯一在线副本 |
| Secrets Manager / KMS | 必需 | `SESSION_SECRET`、`SETTINGS_ENCRYPTION_KEY`、数据库/Redis/SMTP/OAuth 凭据 | 普通业务查询数据 |
| Redis / 托管 KV | 多实例或 serverless 必需；单实例可选 | 登录、注册、密码重置、Agent 调用等短期限流计数 | 健康数据和账号主数据 |
| 私有对象存储 | 当前不需要；有文件上传后需要 | 用户上传、导出归档、离线备份 | 结构化业务关系与鉴权主状态 |

## 1. 主数据库：从 SQLite 切换到托管 PostgreSQL

当前 `prisma/schema.prisma` 仍是 `provider = "sqlite"`。这个数据库实际承载了全部核心状态：账号与 token hash、身体资料、活动/睡眠/恢复记录、日历快照、训练计划、Agent 对话与记忆、Push Token，以及 `UserSettings` 中加密后的模型和 MCP 凭据。它不是一个可以丢失或从缓存重建的数据库。

仓库现有 `compose.production.yml` 把 SQLite 放进 `/data` named volume，适合单机自用；但 README 已明确禁止多个实例共享同一个 SQLite 文件。面向公众开放注册时，建议把 **托管 PostgreSQL 作为上线硬门槛**，选择至少具备以下能力的产品：

- 与应用同地域或邻近地域，生产连接强制 TLS；
- 自动备份，并有满足业务 RPO 的保留期；
- 支持 PITR，能回到误删或错误迁移前的时间点；
- 有高可用/故障切换能力；注意高可用解决硬件/可用区故障，备份与 PITR 才解决误删和逻辑破坏；
- 有连接池或托管 pooler；serverless/弹性实例不能让每个请求无限创建直连；
- 监控容量、连接数、慢查询和备份结果。

PostgreSQL 官方说明，基础备份结合持续归档的 WAL 可以恢复到指定时间点。[PostgreSQL：Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html) Prisma 的官方连接池文档建议应用流量走 pooled connection，而迁移、`pg_dump` / `pg_restore` 等管理操作走 direct connection。[Prisma Postgres：Connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling)

这不是“购买一个 Postgres 后只改 `DATABASE_URL`”就完成。当前 migration 是 SQLite 方言；仓库自己的 `docs/postgres-migration.md` 已要求重建 PostgreSQL 初始 migration、搬迁数据并完成全量回归。换句话说：**目前具备迁移方案，但还没有完成 PostgreSQL 生产切换。**

## 2. 备份：与在线数据库分开设计

正式上线应先定义两个目标：

- **RPO**：最多接受丢失多久的数据，例如 15 分钟或 1 小时；
- **RTO**：发生故障后，最多允许多久恢复服务。

然后反推备份频率、PITR 保留期和恢复流程。推荐至少包含：

1. 托管 PostgreSQL 的自动备份和 PITR；
2. 重大 schema migration 前的手动快照或逻辑备份；
3. 按风险决定是否保留一份跨账号/跨故障域的加密逻辑备份；
4. 定期恢复到隔离数据库，实际查询关键表并记录 RPO/RTO，而不是只检查“备份任务成功”。

PostgreSQL 的 WAL 归档是 PITR 的基础机制。[PostgreSQL 官方文档](https://www.postgresql.org/docs/current/continuous-archiving.html) 托管产品的能力和保留期差异很大，例如 Prisma Postgres 当前文档写明付费计划提供按日 snapshot，但尚未提供细粒度 PITR；最新 snapshot 之后的写入可能无法恢复。[Prisma Postgres：Backups](https://www.prisma.io/docs/postgres/database/backups) 因此选型时不能只看“有自动备份”四个字，要核对实际 RPO、保留期和恢复方式。

AWS Well-Architected 明确建议周期性将备份恢复到新位置，验证数据完整、可访问，并确认真实恢复时间满足 RTO、数据损失满足 RPO。[AWS：Perform periodic recovery](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_backing_up_data_periodic_recovery_testing_data.html)

仓库现有 `data:backup`、`data:restore` 和 `data:drill` 只支持 SQLite。它们对当前单机部署有用，但迁到 PostgreSQL 后必须替换为 PostgreSQL/托管平台对应的自动备份和恢复演练。`HBM_BACKUP_OFFSITE_DIR` 只是目录拷贝接口，不等于已经具备跨故障域备份。

## 3. 密钥存储：数据库备份之外还要能恢复“解密能力”

当前 `UserSettings` 把模型 Key 和部分第三方 token 加密后放在数据库中；解密根密钥来自 `SETTINGS_ENCRYPTION_KEY`。源码明确规定生产环境必须设置它，README 也说明更换或丢失该密钥会让已保存凭据无法读取。

因此正式环境还需要云平台的 Secrets Manager / KMS 或等价能力，至少保存：

- `SETTINGS_ENCRYPTION_KEY` 与 `SESSION_SECRET`；
- PostgreSQL 和 Redis 连接凭据；
- SMTP 密码、飞书 OAuth secret、外部模型服务凭据；
- 恢复后重新连接外部服务所需的配置。

密钥不要写进镜像、Git 或普通数据库备份。需要有受控访问、审计、轮换和灾难恢复方案；数据库恢复演练还应验证旧数据仍可解密。这里的重点是：**只有数据库备份、没有对应密钥，业务仍然不能完整恢复。**

## 4. Redis：它是共享安全计数器，不是第二个业务数据库

单个常驻 Node 进程可以继续用内存限流，不必为了“正式”二字强行增加 Redis。但只要出现负载均衡后的多个实例、serverless 并发实例，或滚动发布期间新旧实例并存，进程内计数就不能统一，此时 Redis 成为必需的共享短期状态。

Redis 官方把它定位为分布式限流的共享计数存储，并说明 `INCR` + `EXPIRE` 可形成自动清理的时间窗口；读取、判断、更新应保持原子性，避免并发竞态。[Redis：Rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/) [Redis：INCR rate limiter pattern](https://redis.io/docs/latest/commands/incr/)

对本项目，Redis 只需要保存带 TTL 的限流 key；它重启后计数归零会短暂放宽限制，但不丢健康主数据，所以通常不必按 PostgreSQL 的耐久性标准购买 Redis 持久化。需要明确 Redis 故障时采用 fail-open 还是 fail-closed，并监控请求失败。

当前 PR 的 Redis 路径仍不能直接作为上线验收依据：`RedisHttpRateLimitStore.consume()` 是异步的，但现有登录、注册、密码重置和 Agent 路由都调用同步 `consumeRateLimit()`，配置 Redis 后会抛错；实现还把 `INCR` 与 `PEXPIRE` 分成两个 HTTP 请求，没有按 Redis 官方建议做成事务或脚本原子操作。应修复并做真实 Redis 集成测试后再启用。

## 5. 对象存储：当前不需要，出现二进制文件后再增加

当前代码没有用户头像、照片、音频、附件或报告文件的上传路径；账户导出是在请求时生成 JSON 下载。因此现阶段不需要为用户文件额外准备 S3 类对象存储，也不要为了架构“看起来完整”提前引入。

未来一旦加入文件功能，应使用私有对象存储，不写容器本地磁盘；数据库只保存 object key、owner、类型、大小、checksum 等元数据。至少启用禁止公开访问、最小权限、加密、版本保护和生命周期清理。S3 官方建议启用 Block Public Access、使用最小权限和加密，并说明 Versioning 可从误删与覆盖中恢复旧版本。[S3 security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html) [S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)

如果把数据库离线备份放进对象存储，它属于“备份体系”的落地介质，而不是因为当前产品需要用户文件存储。

## 推荐的最小上线形态

### 面向公众的正式版本

```text
Web / API 实例
  ├─ 托管 PostgreSQL：唯一业务主库
  ├─ 托管 Redis：跨实例限流；单实例时可暂缓
  └─ Secrets Manager / KMS：数据库、Redis、应用和 OAuth 密钥

托管 PostgreSQL
  └─ 自动备份 + PITR + 隔离恢复演练
       └─ 可选的独立加密逻辑备份 / 私有对象存储
```

### 只供个人使用的单机正式部署

可以暂时保留“单实例应用 + `/data` 持久化 SQLite + 每日在线 snapshot + 真正异地副本”，Redis 不需要；但必须安装可在生产主机上长期运行的调度器并完成恢复演练。仓库现在只提供 macOS LaunchAgent，若生产主机是 Linux/Docker，还需要 cron、systemd timer、平台定时任务或独立 backup job。

## 上线前存储验收清单

- [ ] PostgreSQL schema 与 migration 已从 SQLite 转换，并在 staging 全量回归；
- [ ] 应用使用 pooled connection，迁移/备份使用 direct connection；
- [ ] 自动备份和 PITR 已启用，保留期满足书面 RPO；
- [ ] 已从备份恢复到隔离环境并验证关键表、外键、登录和凭据解密；
- [ ] `SETTINGS_ENCRYPTION_KEY` 等根密钥已放入 Secrets Manager，并有受控恢复方案；
- [ ] 多实例时 Redis 限流调用已改为异步、原子实现并完成真实服务验收；
- [ ] 备份失败、容量不足、连接耗尽、Redis 故障都有监控告警；
- [ ] 当前没有用户文件时不引入对象存储；增加文件功能时同步制定权限、版本和删除策略。

## 主要一手来源

- [PostgreSQL：Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Prisma：PostgreSQL connector](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma Postgres：Connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling)
- [Prisma Postgres：Backups](https://www.prisma.io/docs/postgres/database/backups)
- [Redis：Rate limiter](https://redis.io/docs/latest/develop/use-cases/rate-limiter/)
- [Redis：INCR](https://redis.io/docs/latest/commands/incr/)
- [AWS Well-Architected：Periodic recovery testing](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_backing_up_data_periodic_recovery_testing_data.html)
- [Amazon S3：Security best practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html)
- [Amazon S3：Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
