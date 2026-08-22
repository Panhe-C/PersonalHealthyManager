# 少量用户的低成本上线方案（2026-08-03）

## 结论

只有几位用户时，不建议购买独立的阿里云 RDS PostgreSQL。当前项目优先采用：

> 单实例常驻应用 + 持久化 SQLite `/data/healthy-body.sqlite` + 每日备份 + 异地副本。

这与仓库现有 Docker Compose、备份、校验和恢复工具一致，避免现在就承担 SQLite → PostgreSQL 的迁移和运维成本。SQLite 官方也把低到中等流量网站列为适用场景。

## 方案比较

| 方案 | 适合度 | 主要边界 |
| --- | --- | --- |
| 小型 VPS / Railway + SQLite 持久卷 | 首选 | 只能单实例；必须另做异地备份 |
| Neon Free PostgreSQL | 备选 | 需迁库；免费层目前为每项目 0.5 GB、100 CU-hours/月，空闲会缩容，恢复历史约 6 小时 |
| Supabase Free PostgreSQL | 不作为正式首选 | 500 MB，低活跃约 7 天会暂停；免费层无自动备份 |
| Render + SQLite 持久盘 | 可用但不一定最便宜 | 持久盘只能挂一个服务实例，且需付费服务；默认文件系统是临时的 |
| 同机自建 PostgreSQL | 不推荐 | 对几位用户没有明显收益，却增加升级、备份、WAL 和故障恢复负担 |

Railway Hobby 当前为 5 美元/月的最低月度承诺，包含前 5 美元资源用量；卷按用量计费，支持 SQLite 卷备份。免费层只适合实验，停订后卷数据有删除期限，不能代替自主备份。

## 最小生产配置

1. 只运行一个应用实例，数据库固定写入持久卷 `/data`，不要写容器临时层。
2. 每天运行 `npm run data:backup`，保留至少 14 天。
3. 用 `HBM_BACKUP_OFFSITE_DIR` 或独立同步任务，把加密备份复制到另一故障域，例如本地 Mac、NAS 或对象存储。
4. 用外部监控轮询 `/api/health`。
5. 每季度运行一次 `npm run data:drill`，确认备份真的能恢复。
6. 单独保存 `SETTINGS_ENCRYPTION_KEY`；只有数据库文件而没有该密钥，已加密凭据无法恢复。
7. Linux 主机需要另配 cron、systemd timer 或平台调度；仓库当前自动调度器是 macOS LaunchAgent。

## 何时再迁 PostgreSQL

出现以下任一真实需求再迁移：应用需要多实例、并发写入持续产生锁等待、开放注册后用户明显增长、或必须获得数据库级高可用和更短的恢复点目标。单实例阶段不需要 Redis；当前进程内限流即可。

## 官方资料

- [SQLite: Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html)
- [Neon Pricing](https://neon.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase: Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Railway Pricing Plans](https://docs.railway.com/pricing/plans)
- [Railway Volumes](https://docs.railway.com/volumes/reference)
- [Railway Volume Backups](https://docs.railway.com/volumes/backups)
- [Render Persistent Disks](https://render.com/docs/disks)
