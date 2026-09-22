# SQLite 小规模生产化设计

日期：2026-08-04

## 目标

让 HealthyBodyManager 在“几位用户、单实例、低并发写入”的阶段，以一台常驻 Linux 主机和 SQLite 长期运行，同时具备可验证的数据持久化、每日备份、异地保管和恢复能力。

本次不是数据库迁移。当前 Prisma schema、迁移历史和生产 Compose 已经使用 SQLite；改造重点是补齐生产运维接口。

## 决策

生产阶段继续使用：

```text
单个应用实例
  └─ Docker named volume: /data/healthy-body.sqlite
       └─ 每日一致性快照
            └─ 主机备份目录
                 └─ 独立同步到另一故障域
```

选择理由：

- 用户量和同时写入量很小，SQLite 的单写者约束不是当前瓶颈。
- 应用已经是单实例，暂时不需要 PostgreSQL 的多客户端和横向扩展能力。
- 现有 Prisma migrations、Docker 启动迁移、在线快照和恢复演练都围绕 SQLite 工作。
- 对独立开发者而言，减少数据库服务、连接池、升级和监控组件比提前扩展更重要。

## 范围

### 包含

- 保持生产数据库只能位于持久化 `/data`。
- 增加一个一键执行的 Compose 备份任务：在线快照到主机目录并按保留期清理。
- 确保快照和 manifest 权限不宽于 `0600`。
- 给 Linux 主机提供可复制的 cron/systemd 调度方式。
- 明确真实恢复流程、停止写入要求、异地副本和恢复演练。
- 增加自动化测试与 Compose 配置校验。

### 不包含

- SQLite → PostgreSQL 迁移。
- Redis、多个应用副本或共享网络文件系统。
- 在应用里内置对象存储 SDK。
- 数据库透明加密；备份离开服务器后的加密由加密文件系统或备份工具负责。
- 对现有业务 model、API 或移动端行为做修改。

## 模块和接口

### 1. 在线数据库模块

接口保持不变：应用只通过 `DATABASE_URL=file:/data/healthy-body.sqlite` 访问数据库。`docker-entrypoint.sh` 继续拒绝容器临时目录中的数据库。

实现仍是 Prisma SQLite adapter，单个 `app` 实例拥有读写权。不得让两个应用容器共享该文件。

### 2. 生产备份模块

对运维者暴露一个小接口：

```bash
docker compose -f compose.production.yml --profile maintenance run --rm backup
```

该接口内部完成：

1. 从 `/data/healthy-body.sqlite` 创建一致性 `VACUUM INTO` 快照。
2. 写入 SHA-256 manifest。
3. 将数据库和 manifest 权限收紧为 `0600`。
4. 写入绑定到主机的 `/backups`。
5. 按 `HBM_BACKUP_RETENTION_DAYS` 清理过期快照与 manifest。

备份容器与应用共享只读来源语义，但 SQLite 在线快照仍需要正常打开数据库；它不能启动第二个 Web 应用，也不能执行 schema migration。

### 3. 异地保管模块

Compose 备份目录只是“脱离容器和数据库 volume 的主机副本”，仍可能与服务器一起损坏。运维者必须用 restic、rclone、NAS 同步或云厂商对象存储生命周期规则，将该目录复制到另一故障域。

此模块的接口是备份目录，不在应用内耦合某一家云厂商。

### 4. 恢复模块

真实恢复必须显式执行：

1. 停止 `app`，阻止新写入。
2. 校验目标快照的 SQLite header 和 SHA-256 manifest。
3. 保留当前数据库的 rescue copy。
4. 替换数据库并保持正确属主。
5. 启动应用，验证 `/api/health` 和用户登录。

日常恢复演练默认只恢复到隔离临时文件，不触碰线上数据库。

## 安全与可靠性不变量

- 数据库必须在 `/data` 持久卷；容器层不能成为数据源。
- 生产只允许一个 Web 应用实例。
- named volume 是持久化，不是备份。
- 备份文件包含健康数据，必须限制读取权限，异地传输和存储必须加密。
- `SETTINGS_ENCRYPTION_KEY` 必须独立保存；数据库备份无法替代密钥备份。
- 备份成功不等于可恢复，必须定期执行 `data:drill`。
- 停订任何托管服务前，必须先取得并验证独立副本。

## PostgreSQL 升级触发条件

只有出现以下真实信号才启动迁移：

- 需要两个以上应用实例。
- 持续并发写入造成可观测锁等待或请求超时。
- 开放注册后负载明显增长。
- 需要数据库自动故障转移或更细粒度的 PITR。
- 单机维护窗口已无法满足可用性要求。

## 验收标准

- `docker compose config` 能解析生产配置。
- 一条 Compose 命令能生成 `.sqlite` 和 `.sqlite.json` 两个文件。
- manifest SHA-256 与数据库快照一致。
- 快照和 manifest 权限均不宽于 `0600`。
- 再次执行备份不会中断正在运行的 app。
- 保留期清理只删除匹配的过期备份文件。
- 文档包含 Linux 调度、异地复制和真实恢复步骤。
- 相关测试、完整测试和生产构建通过。
