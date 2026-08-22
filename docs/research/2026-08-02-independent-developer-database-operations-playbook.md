# HealthyBodyManager 独立开发者数据库长期运维手册

> 核对日期：2026-08-02。本文基于当前 `feat/production-readiness` 分支和官方一手资料，目标是用一个人长期做得下去的方式维护线上数据库，而不是复制大公司的值班体系。

## 一句话方案

使用**带自动备份和 PITR 的托管 PostgreSQL**，应用流量走连接池，迁移与备份走直连；把监控、备份失败和费用异常变成自动告警；所有 schema 变更先过 staging；每季度真正恢复一次；把 `SETTINGS_ENCRYPTION_KEY` 等根密钥放在可审计、可恢复的 Secrets Manager 中。

对独立开发者，长期可用性的优先级应是：

```text
能恢复数据 > 能及时发现故障 > 能安全变更 schema > 自动故障切换 > 读副本和复杂分片
```

## 1. 先定一个现实的服务目标

建议首个付费/公开版本采用以下内部目标，再根据真实用户量调整：

| 项目 | 建议起点 | 含义 |
| --- | --- | --- |
| RPO | 15 分钟以内 | 最坏情况下最多丢 15 分钟写入，因此需要相应粒度的 PITR |
| RTO | 4 小时以内 | 一个人也能在半天内完成判断、恢复、验证和重新开放 |
| PITR 保留期 | 7–14 天 | 足以发现多数误删和错误迁移，同时控制早期成本 |
| 独立逻辑备份 | 每周一份，保留 4–8 周 | 防止只依赖同一平台/账号；文件应加密 |
| 恢复演练 | 每季度一次，重大迁移前追加一次 | 备份成功不代表能恢复 |

这些数值是适合早期独立产品的**建议目标**，不是官方标准。若 HealthKit 等同步数据可以从设备重新导入，也不能因此忽略账号、计划、Agent 历史和加密凭据等不可自动重建的数据。

## 2. 托管 PostgreSQL 的最低配置

选择供应商时，不必一开始购买最高规格，但应确认：

- 自动备份、PITR、保留期和恢复到新实例的流程清晰；
- 数据库与应用位于同一或邻近地域，连接强制 TLS；
- 有托管连接池，应用与 migration 使用不同连接方式；
- 能查看 CPU、内存、磁盘、连接数、查询延迟、锁和备份状态；
- 能对容量、故障、维护、备份失败和费用发送站外告警；
- 可以设置存储自动扩容上限，避免“磁盘满”和“无限涨费”两个极端；
- 付费用户对停机敏感后，再打开 Multi-AZ/HA；早期低流量阶段不必先上读副本。

PostgreSQL 官方把 `pg_stat_activity`、`pg_stat_database`、I/O、锁、WAL 和磁盘使用列为核心监控面。[PostgreSQL：Monitoring Database Activity](https://www.postgresql.org/docs/current/monitoring.html) Prisma 官方建议普通应用流量使用 pooled connection，migration、`pg_dump` / `pg_restore` 使用 direct connection。[Prisma Postgres：Connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling)

高可用副本不是备份：副本会复制误删和错误更新；PITR 才用于回到错误发生前。PostgreSQL 的基础备份结合持续 WAL 归档可实现指定时间点恢复。[PostgreSQL：Continuous Archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)

## 3. 备份与恢复：只保留真正能用的备份

### 自动化基线

1. 托管平台持续执行 PITR，并把“最近可恢复时间点”纳入监控；
2. 每周用 direct connection 生成一份加密逻辑备份，放到与数据库不同的故障域；
3. 每次破坏性 migration 前额外创建快照/逻辑备份；
4. 自动删除超出保留期的副本，避免健康数据无限复制；
5. 每季度恢复到隔离实例，不覆盖生产库。

恢复演练至少验证：migration 状态、用户/健康记录/计划等关键表数量、外键与唯一约束、`/api/health`、登录、读取 Today/Plan，以及用恢复出的 `SETTINGS_ENCRYPTION_KEY` 解密一条测试凭据。只做 `SELECT 1` 或只验证 dump 文件存在都不够。

AWS Well-Architected 建议周期性恢复到新位置，并验证完整性、可访问性、实际 RPO 与 RTO。[AWS：Perform periodic recovery](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_backing_up_data_periodic_recovery_testing_data.html)

### 当前仓库差距

- `data:backup`、`data:restore`、`data:drill` 和 14 天 prune 都只支持 SQLite；
- `backup:service` 只提供 macOS LaunchAgent，不适用于云端 Linux/Docker 调度；
- `HBM_BACKUP_OFFSITE_DIR` 是目录复制接口，不证明副本跨账号或跨故障域；
- PostgreSQL 上线前需要新增 provider-native PITR 检查、`pg_dump`/`pg_restore` 流程和隔离恢复验收。

## 4. 监控与告警：只保留能促使你行动的信号

### 必须自动监控

- 外部每 1–5 分钟请求 `/api/health`；连续失败才告警，减少单次网络抖动噪声；
- 5xx、数据库连接失败、migration 失败和错误 webhook 投递；
- 连接池使用率、CPU、可用内存、存储占用/增长率、查询延迟和长事务/锁等待；
- 自动备份是否完成、最近 PITR 时间点是否继续前进；
- 月度实际费用与预测费用。

仓库现有 `/api/health` 会执行 `SELECT 1` 并返回数据库延迟，适合作为基础可用性探针；`src/observability/logger.ts` 支持脱敏 JSON 错误和 `HBM_ERROR_WEBHOOK_URL`。但它们没有覆盖连接池饱和、慢查询、磁盘增长和备份状态，仍需使用托管数据库和监控平台的指标。

初始阈值可从“连接或存储达到 70% 提醒、80–85% 紧急；CPU 持续 15 分钟超过 80%；数据库延迟显著超过近两周基线；备份失败立即通知”开始，运行两到四周后按基线调优。具体阈值是运营建议，不是 PostgreSQL 固定要求。AWS RDS 官方建议先建立负载基线，并明确监控目标、频率、责任人与通知对象。[Amazon RDS：Monitoring metrics](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Monitoring.html)

所有高优先级告警必须发到应用之外的渠道（邮件、短信或手机通知），不能只写进已经故障的服务器日志。

## 5. Schema migration 纪律

每次变更都遵循同一条路径：

```text
本地生成 migration
  → 审查实际 SQL
  → staging 用接近生产的数据量执行
  → 备份/确认 PITR
  → CI/CD 用 direct connection 执行 migrate deploy
  → 发布应用
  → 观察错误率、延迟、锁和容量
```

规则保持简单：

- `prisma/migrations` 与 `migration_lock.toml` 必须入 Git；已经应用的 migration 不编辑、不删除；
- production 不运行 `migrate dev`、`migrate reset` 或 `db push`；只运行 `migrate deploy`；
- 大表和破坏性变更使用 expand → backfill → switch reads/writes → contract，避免一版内“删旧列并立刻要求新列”；
- migration 与应用尽量向前/向后兼容，失败时优先回滚应用；不要在不清楚后果时手工改生产 schema；
- 迁移前记录版本、备份点和回滚判断，迁移后执行关键业务 smoke test。

Prisma 官方明确区分：`migrate dev` 仅用于开发；staging/production 用 `migrate deploy`，并建议放进 CI/CD。[Prisma：Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) 官方也要求完整 migration history 入库，并警告不要修改已应用 migration。[Prisma：Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)

本项目第一次 SQLite → PostgreSQL 是特殊迁移：现有 SQLite migration 不能直接重放。必须按 `docs/postgres-migration.md` 建立新的 PostgreSQL 基线、搬迁数据并做 staging 演练。当前 Docker entrypoint 也只允许 `file:/data/*`，所以“托管 PostgreSQL 已购买”仍不等于应用已可切换。

## 6. 容量与费用控制

独立开发者应先用最小的生产规格和连接池，再由指标驱动升级：

- 每月记录数据库大小、月增长量、连接峰值、CPU/内存峰值和慢查询 Top N；
- 为存储自动扩容设置上限；自动扩容不能代替增长告警和数据保留策略；
- 对历史 Agent 对话、日历快照、通知投递和失效 token 逐类制定保留期，不用“永久保存”作为默认；
- 设置月度预算及 50%/80%/100% 实际费用告警，再加预测超支告警；
- 每季度检查套餐是否过大、备份保留是否过长、是否真的需要 HA/读副本；
- 不为了省钱关闭备份；先减少闲置计算、过长保留和无用副本。

Amazon RDS 官方提醒，存储自动扩容后的已分配容量不能缩小，并建议根据使用模式设置最大阈值，避免异常增长带来意外扩容。[Amazon RDS：Storage autoscaling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html) AWS Budgets 支持实际和预测费用阈值通知，但账单数据和通知存在延迟，不能替代实时容量告警。[AWS：Managing costs with Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

## 7. 密钥与解密恢复

必须放入 Secrets Manager 或等价服务的内容至少包括：

- `DATABASE_URL` 的数据库凭据；
- `SETTINGS_ENCRYPTION_KEY`、`SESSION_SECRET`；
- Redis、SMTP、飞书 OAuth 和错误上报凭据。

其中 `SETTINGS_ENCRYPTION_KEY` 是数据恢复链的一部分：数据库中的模型 Key/MCP token 是用它加密的，丢失后数据库恢复成功也无法解密。当前代码没有在线重加密/多版本 key 机制，因此不要把“定期轮换”简单实现为直接替换环境变量。

可持续做法是：Secrets Manager 开启版本记录和审计；根密钥限制删除权限；保留 break-glass 恢复步骤；季度恢复演练同时验证数据库与密钥；将来需要轮换 `SETTINGS_ENCRYPTION_KEY` 时，先实现旧/新 key 并存和批量重加密流程。AWS Secrets Manager 的删除默认带至少 7 天 recovery window，可在窗口内恢复；KMS key 最终删除后则不可恢复，剩余密文也将无法解密，因此不确定时应先禁用而非删除。[AWS Secrets Manager：Delete and restore a secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_delete-secret.html) [AWS KMS：Deleting keys](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html)

## 8. 故障处理 Runbook

### 数据库不可用

1. 确认外部探针、`/api/health`、托管平台状态和最近变更；
2. 查看连接数、存储、CPU、锁等待和 provider event；暂停继续发布；
3. 若是连接耗尽，先限制应用并发/恢复 pool，而不是盲目扩实例；
4. 若 provider 支持自动 failover，等待并确认重连；否则按供应商流程切换；
5. 恢复后验证登录、Today、Plan 和一次安全写入，再解除事件状态。

### 误删、错误 migration 或数据损坏

1. 立即停止相关写入，记录错误发生时间和最后一个可信时间点；
2. 保留日志和当前数据库，不直接在原库反复尝试修复；
3. 优先恢复到**新实例**，核对目标时间点和关键数据；
4. 切换应用连接，验证读写与凭据解密；
5. 轮换可能暴露的数据库凭据，记录实际 RPO/RTO；
6. 事后补一页复盘：影响、时间线、根因、恢复过程和一个防复发动作。

### Migration 失败

不要在 production 执行 reset，也不要修改已经应用的 migration 文件。先保存错误和 `_prisma_migrations` 状态，判断 migration 是完全未执行、部分执行还是已执行但未记录，再严格按 Prisma 的 production troubleshooting 使用 `migrate resolve` 或后续修复 migration。[Prisma：Production troubleshooting](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing)

## 9. 一个人能坚持的维护节奏

| 周期 | 自动完成 | 人工花费约 10–60 分钟 |
| --- | --- | --- |
| 每天 | 外部健康探针、错误/容量/备份/PITR 告警、费用异常监控 | 只处理告警；不要求每天登录控制台 |
| 每周 | 独立加密逻辑备份、保留期清理 | 看一次备份时间、数据库增长、5xx、慢查询和费用趋势 |
| 每月 | 汇总容量与费用 | 审查连接峰值、Top 慢查询、表增长、失效 token/日志保留；检查联系人和支付方式 |
| 每季度 | 创建恢复演练任务 | 恢复到隔离实例，跑关键流程，记录 RPO/RTO；复查权限、密钥恢复、套餐与 HA 需要 |
| 每次发布 | CI 测试和 migration status | 审 SQL、确认备份点、执行 `migrate deploy`、观察 30–60 分钟 |
| 每次重大迁移 | 额外快照/逻辑备份 | staging 全量演练，预写停止条件、回滚/前滚方案和维护通知 |

原则是“平时靠自动化，固定周期只看摘要；真正耗时的恢复动作按季度练”。如果一个检查没有明确负责人、触发条件和处理动作，就不算可用的监控。

## 当前仓库到目标状态的最短路径

1. 完成 `docs/postgres-migration.md` 中的 SQLite → PostgreSQL 转换，并让容器/部署配置接受 PostgreSQL；
2. 选择带 PITR、连接池、指标和站外告警的托管 PostgreSQL；
3. 把现有 SQLite backup/drill 替换为 PostgreSQL 逻辑备份 + provider PITR 隔离恢复；
4. 给 `/api/health` 配外部探针，接通数据库指标、备份失败和费用告警；
5. 将生产密钥迁入 Secrets Manager，并把解密验证加入季度恢复演练；
6. 把上表的周/月/季度动作建成 recurring checklist，避免依赖记忆。

## 主要一手来源

- [PostgreSQL：Monitoring Database Activity](https://www.postgresql.org/docs/current/monitoring.html)
- [PostgreSQL：Continuous Archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Prisma：Development and production migration workflow](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Prisma：Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
- [Prisma Postgres：Connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling)
- [AWS Well-Architected：Periodic recovery testing](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_backing_up_data_periodic_recovery_testing_data.html)
- [Amazon RDS：Monitoring metrics](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Monitoring.html)
- [Amazon RDS：Storage autoscaling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIOPS.Autoscaling.html)
- [AWS Cost Management：Managing costs with Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [AWS Secrets Manager：Delete and restore a secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_delete-secret.html)
- [AWS KMS：Deleting keys](https://docs.aws.amazon.com/kms/latest/developerguide/deleting-keys.html)
