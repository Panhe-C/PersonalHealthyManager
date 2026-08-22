# 备份与恢复

生产部署是单个 Web 实例，SQLite 的 `/data` 显式绑定到宿主机 `${HBM_DATA_HOST_DIR:-/srv/healthy-body-manager/data}`。宿主机目录只是持久化，不是备份；备份任务把在线 SQLite 快照写到另一个主机目录，再由运维者复制到另一故障域。

## 配置主机备份目录

备份容器以 UID/GID `1001:1001` 运行。Linux 主机第一次部署时先创建目录，并让该 UID 可以写入：

```bash
sudo mkdir -p /srv/healthy-body-manager/backups
sudo mkdir -p /srv/healthy-body-manager/data
sudo chown 1001:1001 /srv/healthy-body-manager/data /srv/healthy-body-manager/backups
sudo chmod 700 /srv/healthy-body-manager/data /srv/healthy-body-manager/backups
```

在部署目录的 `.env` 中设置主机路径和保留期（路径必须是 Docker daemon 所在主机上的路径）：

```dotenv
HBM_BACKUP_HOST_DIR=/srv/healthy-body-manager/backups
HBM_DATA_HOST_DIR=/srv/healthy-body-manager/data
HBM_BACKUP_RETENTION_DAYS=14
```

不要把 `SETTINGS_ENCRYPTION_KEY`、SMTP 密码或其他应用密钥传给备份服务。备份服务只需要 SQLite 路径和保留期；它以只读方式挂载宿主机数据目录，不启动 Web，也不执行 Prisma migration。

## 手动和定时备份

从仓库目录执行一次备份：

```bash
cd /srv/healthy-body-manager
docker compose --env-file .env -f compose.production.yml --profile maintenance run --rm backup
```

该命令依次完成在线 `VACUUM INTO`、SHA-256 manifest 写入和保留期清理。每次成功执行都会在 `HBM_BACKUP_HOST_DIR` 产生一对文件：

```text
healthy-body-<timestamp>.sqlite
healthy-body-<timestamp>.sqlite.json
```

数据库、manifest 以及通过 `HBM_BACKUP_OFFSITE_DIR` 产生的异地目录副本都会显式设置为 `0600`。目录本身建议保持 `0700`。清理只匹配 `.sqlite` 与 `.sqlite.json` 备份文件，不会删除其他文件。

Linux cron 示例（使用绝对路径，避免 cron 的工作目录和 `PATH` 差异）：

```cron
15 3 * * * cd /srv/healthy-body-manager && /usr/bin/docker compose --env-file /srv/healthy-body-manager/.env -f /srv/healthy-body-manager/compose.production.yml --profile maintenance run --rm backup >> /var/log/healthy-body-manager-backup.log 2>&1
```

确认 `/usr/bin/docker` 与项目路径符合主机实际安装位置；先手动运行一次并检查日志，再启用 cron。若使用 systemd timer，timer 的 `WorkingDirectory` 应设为 `/srv/healthy-body-manager/app`，`ExecStart` 使用同一条 Compose 命令。

仓库附带可直接安装的 systemd 单元，默认每天 `03:15 Asia/Shanghai` 执行，并在错过运行时间后补跑：

```bash
sudo install -m 0644 deploy/systemd/healthy-body-manager-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/healthy-body-manager-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now healthy-body-manager-backup.timer
systemctl list-timers healthy-body-manager-backup.timer
```

启用 OSS 异地备份时，再安装 root 持有的上传脚本和服务。本地备份成功后，
`OnSuccess` 才会触发 OSS 上传：

```bash
sudo install -m 0755 scripts/oss-backup-upload.sh /usr/local/sbin/healthy-body-manager-oss-upload
sudo install -m 0644 deploy/systemd/healthy-body-manager-oss-upload.service /etc/systemd/system/
sudo systemctl daemon-reload
```

将最小权限 RAM 用户的凭证保存在 `/etc/hbm-oss.env`，权限设为 `0600`；
Bucket 必须保持私有，并仅授权指定备份前缀。上传脚本会重新下载刚上传的
SQLite 文件，与本地快照比较 SHA-256，匹配后才报告成功。

macOS 本地开发仍可使用 LaunchAgent：

```bash
npm run backup:service -- install
npm run backup:service -- status
npm run backup:service -- uninstall
```

## 异地副本和加密

主机备份目录仍可能与服务器一起丢失。至少同步到另一台主机、NAS 或对象存储故障域，并在传输和静态存储时加密。推荐使用 restic（仓库密码放在主机密钥管理器或权限为 `0600` 的密码文件中）：

```bash
export RESTIC_REPOSITORY='s3:https://object.example/hbm-restic'
export RESTIC_PASSWORD_FILE='/etc/healthy-body-manager/restic-password'
restic backup /srv/healthy-body-manager/backups --tag healthy-body-manager
restic check
```

也可以使用带加密层的 rclone remote 或 NAS 加密卷。不要把未加密的健康数据快照上传到公共位置，也不要把对象存储密钥写进 Compose 文件。定期在隔离目录恢复一份异地副本，并核对 manifest；同步成功不等于恢复成功。

## 恢复前的校验和演练

日常演练只恢复到隔离临时文件，不触碰线上数据库：

```bash
npm run data:drill
```

选择目标快照后，在 Linux 主机上先校验 SQLite header 和 manifest。以下示例假定 `sha256sum` 和 `jq` 已安装：

```bash
SNAPSHOT=/srv/healthy-body-manager/backups/healthy-body-<timestamp>.sqlite
test "$(od -An -tx1 -N 16 "$SNAPSHOT" | tr -d ' \n')" = "53514c69746520666f726d6174203300"
test "$(sha256sum "$SNAPSHOT" | awk '{print $1}')" = "$(jq -r .sha256 "$SNAPSHOT.json")"
```

如果快照来自异地同步，先在同步目标上完成相同校验，再开始线上恢复。

## 真实恢复

真实恢复会中断服务并覆盖当前数据库。执行前安排维护窗口，确认快照路径和对应的独立 `SETTINGS_ENCRYPTION_KEY` 已可取回。完整流程如下：

```bash
cd /srv/healthy-body-manager
SNAPSHOT=healthy-body-<timestamp>.sqlite
BACKUP_DIR=/srv/healthy-body-manager/backups

# 1. 阻止新写入
docker compose --env-file .env -f compose.production.yml stop app

# 2. 用同一个 UID 在停止的应用镜像中校验并恢复。
#    /app/backups 同时承载来源快照和 pre-restore rescue copy。
docker compose --env-file .env -f compose.production.yml run --rm --no-deps \
  --entrypoint node \
  -v "$BACKUP_DIR:/app/backups" \
  app scripts/data-restore.mjs --from "/app/backups/$SNAPSHOT" --confirm

# 3. 启动应用并检查容器和健康接口
docker compose --env-file .env -f compose.production.yml up -d app
docker compose --env-file .env -f compose.production.yml ps
curl --fail http://127.0.0.1:${HBM_PORT:-3000}/api/health
```

`data-restore.mjs` 会先把当前 `/data/healthy-body.sqlite` 保存到 `backups/pre-restore-*`，再替换数据库并删除 SQLite 的 `-wal`、`-shm` 和 `-journal` sidecar。若恢复后的健康检查或登录验证失败，停止应用并使用 rescue copy 重复上述流程。不要在应用仍运行并写入时替换数据库。

恢复后再次运行 `docker compose ... --profile maintenance run --rm backup`，确认新的快照和 manifest 可读。保留恢复前的 rescue copy，直到业务验证完成并至少有一份独立副本。

## 密钥保管

`SETTINGS_ENCRYPTION_KEY` 与数据库备份是两个独立的恢复材料。数据库快照包含加密后的用户设置，但不包含解密密钥；没有原来的 key，恢复后的 provider 凭据无法读取。将 key 保存在独立的密码管理器、主机 secret store 或加密离线介质中，限制读取权限并保留恢复人员可用的 break-glass 流程。更换 key 前必须先设计旧/新 key 并存和数据重加密流程；直接替换会让已有密文不可解密。

停止任何托管服务、删除主机或轮换密钥前，先取得并验证数据库、manifest、异地加密副本和 `SETTINGS_ENCRYPTION_KEY` 的独立副本。

## HTTPS reverse proxy

The production Caddy configuration is stored in `deploy/Caddyfile`. Install it
as `/etc/caddy/Caddyfile`, validate it with `caddy validate`, and keep the app
bound to `127.0.0.1:3000`. The application-server firewall should expose only
22 (SSH), 80 (ACME/redirect), and 443 (HTTPS); public port 3000 must remain closed.
See [production deployment](production-deployment.md) for the canonical domain,
ICP filing boundary, registration/SMTP choice, and OSS acceptance gaps.
