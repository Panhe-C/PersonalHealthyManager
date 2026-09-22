# 停止付费后，如何把 HealthyBodyManager 数据真正留在自己手里

> 核对日期：2026-08-02。服务商的降级、暂停、删除和账号终止是四种不同状态，政策也会变化。本文只把服务商保留期当作应急缓冲；真正的数据所有权来自开发者已导出、能独立解密并做过恢复验证的副本。

## 结论先行

不要等取消订阅时才第一次导出。长期应同时维护：

1. **服务商内恢复能力**：自动备份/PITR，用来处理日常误删；
2. **服务商外可移植备份**：PostgreSQL `pg_dump` archive，用来换供应商或停止付费；
3. **独立密钥保管**：`SETTINGS_ENCRYPTION_KEY` 等密钥不与 dump 放在一起；
4. **真实恢复记录**：定期恢复到全新的 PostgreSQL，证明备份不是摆设。

```text
仍在付费时导出并验证
        ↓
全新 PostgreSQL 恢复成功
        ↓
应用切换并观察
        ↓
最后才降级、取消或删除旧项目
```

服务商写着“删除后 7 天可恢复”或“暂停后 90 天可恢复”，不等于开发者拥有备份：它仍依赖原账号、原平台和当时有效的政策。

## 代表性服务商的当前边界

| 服务商与动作 | 官方当前说明 | 应如何理解 |
| --- | --- | --- |
| Neon 降级到 Free | 组织需满足 Free 的成员数和资源限制；当前 Free 恢复窗口最多 6 小时，Launch 最多 7 天，Scale 最多 30 天 | 成功降级不等于删除项目，但付费 PITR/快照降级后如何保留没有明确承诺；必须提前导出 |
| Neon 删除项目 | 2025-12 起可在 7 天内用 API 恢复；旧项目管理页仍写“不可逆” | 采用保守口径：7 天只是意外删除缓冲，第 7 天后不可指望恢复 |
| Supabase 降级到 Free | 取消付费表现为降级；付费日备份/PITR 是否在降级后继续可用没有明确承诺 | 降级前完成手工逻辑导出 |
| Supabase Free 暂停 | 专门政策页写明暂停后可在 90 天内一键恢复；其他页面存在“一年”说法冲突 | 按更保守的 90 天执行；下载入口也不能当无限期归档 |
| Supabase 删除项目 | 数据库、Auth、Storage objects、配置、备份和 PITR 都永久移除且无法恢复 | 要保留数据时绝不能用“删除”代替“暂停/降级” |
| AWS RDS 删除实例 | 可选 final snapshot；手工/final snapshot 可继续保留并计费；保留的自动备份只保留到原 retention window | 这是控制面恢复能力，仍应另有供应商外逻辑备份 |

Neon 当前降级条件和项目删除说明见 [Manage organizations](https://neon.com/docs/manage/orgs-manage) 与 [Manage projects](https://neon.com/docs/manage/projects)；2025-12 新增的删除恢复窗口见 [Recover Project API](https://api-docs.neon.tech/reference/recoverproject) 和 [官方 changelog](https://neon.com/docs/changelog/2025-12-19)。Neon 各套餐当前恢复窗口见 [Pricing](https://neon.com/pricing)。官方没有承诺降级后继续保留超出 Free 限额的旧恢复历史，因此不能把它当退出备份。

Supabase 明确说明删除项目后所有数据与备份不可恢复。[Deleting Your Project](https://supabase.com/docs/guides/platform/delete-project) Free 项目暂停的专门页面给出 90 天恢复窗口。[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) 付费日备份分别有 7/14/30 天的套餐保留期，但删除项目也会删除这些备份。[Database Backups](https://supabase.com/docs/guides/platform/backups)

RDS 删除时可以保留自动备份到原 retention window，也可以保留 final/manual snapshot，但这些快照会继续计费。[Amazon RDS：Deleting a DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html)

## HealthyBodyManager 必须导出什么

### 1. PostgreSQL 全库逻辑备份

推荐生成 custom-format archive：

```bash
pg_dump --format=custom --verbose --no-owner --no-privileges \
  --file=healthy-body-manager-YYYY-MM-DD.dump \
  "$DIRECT_DATABASE_URL"
```

使用 **direct/unpooled connection**；不要通过 PgBouncer 连接做 dump。`pg_dump` 能在数据库继续读写时创建一致性逻辑快照，custom archive 可由 `pg_restore` 选择和重排对象，并可跨机器架构迁移。[PostgreSQL：pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) [Neon：Migrate with pg_dump/pg_restore](https://neon.com/docs/import/migrate-from-neon)

版本规则：`pg_dump` 客户端不能比源服务器 major version 老；恢复到更新 PostgreSQL 通常受支持，恢复到更老版本不保证成功。每次 archive 都记录源 PostgreSQL、`pg_dump`、Prisma 和应用 Git commit 版本。

### 2. Schema 与应用恢复材料

与 dump 一起保存但独立版本管理：

- `prisma/schema.prisma`、完整 `prisma/migrations/` 和 `migration_lock.toml`；
- 对应 Git commit、`package-lock.json`、Node/Prisma/PostgreSQL 版本；
- 数据库 extensions、数据库名、region、连接池模式和定时任务清单；
- 一份不含秘密值的环境变量名称清单。

`pg_dump` 只导出一个 database，不包含 cluster-wide roles 和 tablespaces；托管平台的 IAM、网络、告警、定时任务、API keys 和控制面配置也不会自动进入 dump。[PostgreSQL：SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)

### 3. 独立密钥包

至少保管：

- `SETTINGS_ENCRYPTION_KEY`；
- `SESSION_SECRET`；
- SMTP、飞书 OAuth、Redis 与模型服务凭据的重建/轮换说明；
- 备份文件自身的解密密钥。

数据库中的模型 Key 和部分 MCP token 需要 `SETTINGS_ENCRYPTION_KEY` 才能解密。密钥丢失时，数据库恢复成功也不等于业务恢复成功。密钥应保存在 Secrets Manager 和一个受控的离线恢复位置，不能以明文和 dump 放在同一个 bucket、同一个账号或同一台电脑。

### 4. 文件对象和平台专属数据

当前 HealthyBodyManager 没有用户文件上传，所以暂时没有对象存储迁移项。以后若加入照片、音频或附件，必须单独下载真实对象；数据库通常只含对象 metadata。

使用 Supabase 时尤其要注意：数据库备份不包含 Storage 实际对象；CLI 默认 dump 还会排除部分平台管理 schema，schema、data、roles 和 Storage objects 需要按官方流程分别导出。[Supabase：Database Backups](https://supabase.com/docs/guides/platform/backups) [Supabase：Backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

### 5. 用户 JSON 导出只是补充

仓库现有 `/api/v1/account/export` 会导出个人资料、健康记录、目标、计划、Agent 对话和脱敏设置，适合用户携带数据；但它不包含密码哈希、会话、Push Token、通知投递、明文密钥等完整运行状态，也没有整站 importer。它**不能替代 PostgreSQL 全库备份**。

## 自己掌控的备份包

建议每个退出/归档包包含：

```text
hbm-exit-YYYY-MM-DD/
  database.dump.enc
  manifest.json
  restore-runbook.md
  schema-and-migrations.git.bundle   # 或对应源码 release/tag
```

`manifest.json` 至少记录创建时间、源/客户端 PostgreSQL 版本、Git commit、文件大小、SHA-256、关键表行数和使用的加密方案。备份先在本地加密，再上传到两个不同故障域；至少一份不依赖原数据库服务商账号。解密密钥另处保管。

不要保存未加密的健康数据 dump，也不要把生产 `DATABASE_URL` 写入 shell history、manifest 或 Markdown。恢复不可信来源的 dump 前要审查内容；PostgreSQL 官方提醒，restore 会执行 dump 内的 SQL 代码。[PostgreSQL：pg_dump security warning](https://www.postgresql.org/docs/current/app-pgdump.html)

## 停止付费的安全时间线

### 平时

- 每周或每月生成一份供应商外加密 `pg_dump`，频率由可接受的数据损失决定；
- 每季度在另一个全新 PostgreSQL 上恢复一次；
- 每次验证 manifest checksum、migration 状态、关键表行数、登录、Today/Plan，以及测试凭据解密。

### 计划退出前 7–30 天

1. 确认目标是“降级保留在线服务”“迁移到新供应商”还是“完全离线归档”；
2. 核对源/目标 PostgreSQL 版本、extensions、角色和目标容量；
3. 生成完整加密 dump、源码恢复材料和密钥恢复包；
4. 在目标 PostgreSQL 真实恢复并执行应用级 smoke test；
5. 若有对象存储，再单独迁移对象并核对数量/checksum。

### 正式切换

1. 将旧系统置于维护/只读状态，停止自动同步和后台写入；
2. 创建最后一份 dump 与 manifest；
3. 恢复目标库，执行 `ANALYZE`，核对关键表、约束、migration 和凭据解密；
4. 更新应用连接，验证登录、健康同步、Today、Plan、Agent 和安全写入；
5. 观察稳定后轮换数据库凭据；
6. 能承受费用时，让旧项目只读保留一个短观察期；
7. 确认两个外部副本和一次成功恢复记录后，最后才降级或删除。

PostgreSQL 建议从干净数据库恢复，plain SQL restore 应在错误时停止；逻辑 dump 恢复后应运行 `ANALYZE`。[PostgreSQL：SQL Dump recovery](https://www.postgresql.org/docs/current/backup-dump.html)

## 最短退出检查清单

- [ ] 当前付费期结束前已完成 full `pg_dump`，不是只下载用户 JSON；
- [ ] dump 在原服务商之外至少有一份加密副本和 SHA-256；
- [ ] `SETTINGS_ENCRYPTION_KEY` 等密钥独立保管且可由本人恢复；
- [ ] migrations、版本、extensions 和平台配置清单齐全；
- [ ] 已在全新 PostgreSQL 上完成一次真实恢复和核心流程验证；
- [ ] 文件对象如存在已单独导出并核对；
- [ ] 已确认是降级、暂停还是删除，并采用更保守的官方保留窗口；
- [ ] 只有在新库可用且外部备份可恢复后，才取消或删除旧服务。

## 最重要的边界

**平台备份解决“平台仍在、账号仍能访问时如何恢复”；开发者控制的加密逻辑备份解决“平台、套餐或账号都不存在时如何恢复”。** 前者不能替代后者。

## 主要一手来源

- [PostgreSQL：SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)
- [PostgreSQL：pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL：pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [Neon：Manage organizations](https://neon.com/docs/manage/orgs-manage)
- [Neon：Recover Project API](https://api-docs.neon.tech/reference/recoverproject)
- [Neon：2025-12-19 project recovery changelog](https://neon.com/docs/changelog/2025-12-19)
- [Neon：Migrate from a Neon project](https://neon.com/docs/import/migrate-from-neon)
- [Supabase：Manage your subscription](https://supabase.com/docs/guides/platform/manage-your-subscription)
- [Supabase：Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase：Deleting Your Project](https://supabase.com/docs/guides/platform/delete-project)
- [Supabase：Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Amazon RDS：Deleting a DB instance](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html)
