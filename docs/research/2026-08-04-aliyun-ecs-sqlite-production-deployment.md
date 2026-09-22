# HealthyBodyManager 在阿里云 ECS 上运行 SQLite 的生产部署研究（2026-08-04）

## 结论

HealthyBodyManager 可以先以一台阿里云 ECS、单个 Docker Compose 应用实例和一份 SQLite 数据库正式上线。面向几位到几十位低并发用户，建议从以下配置起步：

| 项目 | 建议购买或配置 |
| --- | --- |
| 地域 | 面向中国内地用户且可以完成备案：选择距离主要用户近的中国内地地域；想先绕开 ICP 上线流程：选择中国香港，但需接受网络时延和后续合规路径不同 |
| 实例 | 经济型 e 实例或同级实例，**2 vCPU / 4 GiB 内存**；不要从 0.5–1 GiB 内存规格起步 |
| 操作系统 | Alibaba Cloud Linux 3 或 Ubuntu LTS 64 位 |
| 公网 | 固定公网 IP 或独立 EIP；低流量阶段可从 3–5 Mbps 或按使用流量计费起步 |
| 系统盘 | 40 GiB ESSD Entry 或 ESSD PL0 |
| 数据盘 | **推荐增加一块 20–40 GiB ESSD Entry/PL0 数据盘**，专门承载 SQLite；极限省钱时可以暂时只用系统盘，但恢复和迁机边界更差 |
| 数据库 | 只运行一个应用实例，数据库文件固定为 `/data/healthy-body.sqlite`，最低可行拓扑使用 ECS 挂载云盘 |
| 入口 | Nginx 或 Caddy 监听 80/443，反向代理到仅监听 `127.0.0.1:3000` 的应用 |
| 备份 | 应用级 SQLite 快照每天至少一次并上传私有 OSS；数据云盘每天自动快照；两者不能互相替代 |

`2 vCPU / 4 GiB` 是本项目的保守最低生产基线，不是阿里云强制下限。项目需要在主机上构建 Next.js 镜像、执行 Prisma migration、运行应用并制作备份，4 GiB 能给构建和突发请求留出余量。阿里云经济型 e 实例定位于中小型网站、开发测试和经典轻量应用，并提供 2 vCPU / 4 GiB 的 `ecs.e-c1m2.large` 规格；具体地域是否可售以购买页为准。[阿里云：共享型与经济型实例规格族](https://help.aliyun.com/zh/ecs/user-guide/shared-instance-families)

## 一、必须先决定地域与备案路径

### 路径 A：中国内地 ECS

如果域名或 API 域名解析到阿里云中国内地服务器，需要先完成 ICP 备案；即便域名只用于 API、内网穿透或非标准端口，也不因此免备案。备案后开通服务，并按要求进行公安联网备案。[阿里云：ICP备案流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)

HealthyBodyManager 还包含 iOS 客户端。阿里云官方说明，可安装在 iOS/Android 等平台的原生 App 需要 App 备案，App 使用的后台域名需要按实际情况填写；网站备案号不能代替 App 备案号。[阿里云：App 备案 FAQ](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/basics-about-icp-filling-for-apps)

产品涉及健康管理信息，是否落入当地管局要求前置审批的“医疗保健类”不能只凭产品名称判断。阿里云列出的医疗保健等行业可能需要前置审批文件，因此购买前应按备案主体所在省市的管局规则确认分类；本文不作法律认定。[阿里云：备案信息填写常见问题](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/fill-in-the-information-and-website-faq)

备案使用的 ECS 需满足阿里云备案服务器条件。官方当前说明，中国内地包年包月 ECS 需要购买公网带宽，购买时长通常需达到 3 个月（含续费累计）；实际资格应在购买页和备案控制台再次确认。[阿里云：备案前期准备](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/overview)

### 路径 B：中国香港 ECS

阿里云官方说明，中国香港及海外服务器不需要办理 ICP 备案。若目标只是尽快完成首次公网演练，香港地域能减少上线前手续；但它不是中国内地备案的替代方案，后续迁入内地仍需办理备案，并应另行确认 App 分发及公安联网备案义务。[阿里云：ICP备案流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)

## 二、磁盘选择与 SQLite 的真实落盘位置

### 推荐：系统盘与数据盘分开

- 系统盘存放操作系统、Docker、镜像和日志。
- 独立数据盘格式化为 ext4，挂载到例如 `/srv/hbm-data`，通过 `/etc/fstab` 按 UUID 开机自动挂载。
- SQLite 数据目录绑定到 `/srv/hbm-data`，不要依赖容器可写层。
- 数据盘关闭“随实例释放”，并为 ECS 开启释放保护。释放实例时，系统盘以及配置为随实例释放的数据盘都会永久删除；未配置随实例释放的独立云盘可以保留，但仍继续计费。[阿里云：释放 ECS 实例的影响](https://help.aliyun.com/en/ecs/user-guide/release-an-instance)、[阿里云：释放云盘与随实例释放设置](https://help.aliyun.com/en/ecs/user-guide/release-a-disk)

阿里云云盘挂载后必须先创建文件系统并挂载才能使用；控制台临时挂载不会在重启后持续，必须配置自动挂载。[阿里云：初始化 Linux 数据盘](https://help.aliyun.com/zh/ecs/user-guide/initialize-a-data-disk-whose-size-does-not-exceed-2-tib-on-a-linux-instance/)

ESSD 云盘使用三副本和端到端校验，本地冗余 ESSD 官方标称 99.9999999% 数据可靠性，但三副本解决的是基础设施硬件故障，不能防止误删、应用错误或恶意操作，仍需要快照和独立备份。[阿里云：ESSD 云盘数据可靠性](https://help.aliyun.com/zh/ecs/user-guide/essd-cloud-disk-data-reliability)

### 当前仓库必须处理的挂载差距

当前 `compose.production.yml` 使用：

```yaml
volumes:
  - hbm-data:/data
```

这是 Docker 命名卷，默认位于 Docker 数据根目录，通常仍在系统盘。仅仅购买并挂载数据盘，不会让 `hbm-data` 自动迁移到数据盘。正式部署前必须选择一种明确方案：

1. 将 Compose 改为 bind mount，例如 `/srv/hbm-data:/data`；或
2. 为 `hbm-data` 配置绑定到 `/srv/hbm-data` 的 local volume driver；或
3. 把 Docker 的整个 data-root 迁移到数据盘。

本项目优先选择第 1 种，路径最直观，恢复时也最容易验证。挂载点需要由容器运行用户 UID/GID `1001:1001` 可写。若暂时只买系统盘，现有命名卷能够工作，但必须接受释放系统盘即丢失本地数据库的风险，并依赖 OSS 备份恢复。

除卷映射外，仓库当前还有三项线上缺口：备份服务只把文件写到宿主机目录，尚未自动上传 OSS；仓库没有随应用部署的 Nginx/Caddy HTTPS 配置；Linux 定时备份目前只有 cron/systemd 操作说明，没有可直接安装的 timer 单元。这三项需要在购买资源后、上线验收前补齐。

## 三、快照与 OSS 备份应组成两层保护

### 第一层：SQLite 应用级备份到 OSS

每天至少运行一次仓库的 maintenance backup，使 SQLite 生成一致性快照和 SHA-256 manifest；随后将产物加密上传到另一个故障域中的私有 OSS Bucket。建议：

- Bucket 禁止公共访问，只给备份使用的 RAM 身份最小上传权限。
- 启用 SSE-OSS（AES-256）服务端加密；如果备份包含用户健康数据，再在客户端用独立密钥加密后上传。修改 Bucket 默认加密不会追溯已有对象。[阿里云：OSS 服务端加密](https://help.aliyun.com/en/oss/user-guide/server-side-encryption-8)
- 用生命周期规则将旧版本转为低频或归档，并在约定期限后删除。可采用 `0–30 天 Standard、30–90 天 IA、90–365 天 Archive、365 天删除`；这避开了 IA 最低 30 天、Archive 最低 60 天的最低保存期额外费用。[阿里云：OSS 生命周期规则](https://help.aliyun.com/zh/oss/user-guide/overview-54/)、[阿里云：OSS 存储类型](https://help.aliyun.com/en/oss/user-guide/overview-53/)
- OSS Bucket 与 ECS 至少不要依赖同一块云盘；更高要求时选择不同地域。
- `SETTINGS_ENCRYPTION_KEY` 不得只保存在 ECS 或数据库备份中，应单独离线保管。

OSS 本地冗余 LRS 官方标称 99.999999999% 数据持久性，同城冗余 ZRS 标称 99.9999999999%；ZRS 能覆盖同地域多可用区故障，但不能覆盖整个地域。需要地域级恢复时，应使用另一个地域的 Bucket 或跨区域复制 CRR。[阿里云：OSS 存储冗余类型](https://help.aliyun.com/en/oss/user-guide/overview-of-storage-redundancy-types/)、[阿里云：OSS 跨区域复制](https://help.aliyun.com/en/oss/user-guide/cross-region-replication-with-the-same-account)

### 第二层：数据云盘自动快照

ECS 不会自动备份云盘数据，需要主动创建自动快照策略。建议每日快照保留 7–14 天，每周快照保留 4–8 周；重大升级、迁移或恢复演练前再创建手动快照。自动策略支持自定义执行时间、保留时间和跨地域复制；创建快照时块存储 I/O 性能通常会短暂下降，官方建议避开业务高峰。[阿里云：快照概述](https://help.aliyun.com/zh/ecs/user-guide/snapshot-overview)、[阿里云：创建自动快照策略](https://help.aliyun.com/zh/ecs/user-guide/create-an-automatic-snapshot-policy-1)

运行中数据库可能存在尚未落盘的数据，普通云盘快照不应被视为 SQLite 的唯一一致性备份；阿里云的应用一致性快照需要预处理/后处理脚本或文件系统冻结。因此本项目应以 SQLite 在线备份脚本为主要恢复来源，云盘快照作为整盘灾难恢复的第二层。[阿里云：创建应用一致性快照](https://help.aliyun.com/zh/ecs/user-guide/create-application-consistent-snapshots-in-the-ecs-console/)

标准快照第一份是全量快照，后续为增量快照，因此不必按“每天复制整块磁盘”估算空间。但快照仍会产生费用，删除云盘或实例时还需确认自动快照是否配置为随盘删除。[阿里云：快照原理](https://help.aliyun.com/zh/ecs/user-guide/how-do-snapshots-work)

云盘快照用于整盘回滚和主机灾难恢复；SQLite 应用备份用于校验、单文件恢复和异地保管。只做其中一层都不足以称为可恢复的生产方案。

## 四、安全组与主机暴露面

最小安全组入方向规则：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 | 仅开发者固定公网 IP `/32` | SSH 运维；不允许长期向 `0.0.0.0/0` 开放 |
| TCP 80 | `0.0.0.0/0`、按需 `::/0` | HTTP，仅用于跳转 HTTPS 和证书验证 |
| TCP 443 | `0.0.0.0/0`、按需 `::/0` | HTTPS 业务入口 |

不要在安全组开放 3000、SQLite 文件、Docker daemon、Prisma Studio 或其他管理端口。阿里云把安全组定义为 ECS 的虚拟防火墙，并明确建议 80/443 可按需公网开放，而 22 和管理面板端口仅允许可信 IP。[阿里云：使用安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups)

当前 Compose 已将应用映射为 `127.0.0.1:${HBM_PORT:-3000}:3000`，适合在同机 Nginx/Caddy 后面运行。还应在操作系统防火墙重复实施相同最小暴露策略，禁止密码 SSH 登录，改用密钥，并及时安装安全更新。

## 五、域名、DNS 与 HTTPS

1. 为 `api.example.com` 或产品域名添加 A 记录，指向 ECS 固定公网 IPv4 或 EIP。A 记录用于把域名解析到 IPv4；阿里云免费 DNS 默认最小 TTL 为 600 秒。[阿里云：添加 DNS 解析记录](https://help.aliyun.com/zh/dns/pubz-add-parsing-record)
2. 在 Nginx/Caddy 上配置证书，让 80 自动跳转 443，反向代理到 `127.0.0.1:3000`。
3. 将 `HBM_APP_BASE_URL` 设置为真实 HTTPS origin，不能继续使用 localhost 或裸 IP。
4. 证书可以来自阿里云数字证书管理服务，也可以使用受信任的 ACME CA；应配置到期提醒和自动续期。阿里云官方的 ECS HTTPS 方案以 Nginx 作为 SSL 终止点，支持给现有 Web 服务部署证书。[阿里云：为 ECS Web 服务开启 HTTPS](https://help.aliyun.com/zh/ecs/user-guide/ssl)
5. 如需让更换 ECS 不改变公网入口，优先使用可解绑、重绑的 EIP；直接分配给实例的固定公网 IP 会在释放实例后被回收。[阿里云：ECS IP 地址](https://help.aliyun.com/zh/ecs/user-guide/ip-address/)、[阿里云：释放 ECS 实例的影响](https://help.aliyun.com/en/ecs/user-guide/release-an-instance)

## 六、从购买到上线的验收顺序

1. 选定中国内地或中国香港路径，先确认备案与 App 备案条件。
2. 购买 2 vCPU / 4 GiB ECS、系统盘、公网入口；生产优先再加独立数据盘。
3. 初始化并持久挂载数据盘，确认重启后挂载点仍存在。
4. 安装 Docker Engine 与 Compose plugin，设置 Docker 开机自启。阿里云为 Alibaba Cloud Linux、Ubuntu 和 Debian 提供了官方安装流程。[阿里云：在 Linux 安装 Docker 和 Docker Compose](https://help.aliyun.com/zh/ecs/user-guide/install-and-use-docker)
5. 修正 Compose 的 SQLite 卷映射，部署应用，并执行数据库 migration 和 owner 初始化。
6. 先在 ECS 本机验证 `/api/health`，再配置 Nginx/Caddy、DNS 和 HTTPS。
7. 配置安全组，只开放 22/80/443，其中 22 仅允许管理员 IP。
8. 手动运行一次 SQLite backup，验证 manifest，再上传私有 OSS。
9. 配置每日备份、OSS 生命周期和数据盘自动快照。
10. 在一台临时容器或临时目录中执行真实恢复演练，验证用户数据和加密设置可读取。
11. 重启 ECS，确认数据盘自动挂载、Docker 自动启动、应用健康检查和 HTTPS 都恢复正常。
12. 最后才接入真实用户；记录恢复点目标、恢复时间目标、备份密钥保管人和 ECS 到期续费提醒。

## 七、上线判定标准

只有同时满足以下条件，才算“线上真实环境跑通”，而不只是 Compose 能解析或镜像能构建：

- 公网域名通过 HTTPS 可访问，证书链有效。
- ECS 重启后 SQLite 文件仍位于预期数据盘，用户数据没有回到空库。
- 安全组未开放 3000 和任何数据库/管理端口。
- 真实创建一份 SQLite 快照并上传 OSS，下载后哈希校验通过。
- 使用该 OSS 备份在隔离位置完成一次恢复，应用能读取恢复后的用户与设置数据。
- 数据盘自动快照策略已绑定并成功产生至少一份快照。
- `SETTINGS_ENCRYPTION_KEY` 在 ECS 之外存在可恢复副本。
- 中国内地部署所需的网站/App 备案路径已经完成或得到明确确认。

## 官方资料索引

- [经济型 ECS 实例规格族](https://help.aliyun.com/zh/ecs/user-guide/shared-instance-families)
- [Linux 安装 Docker 与 Compose](https://help.aliyun.com/zh/ecs/user-guide/install-and-use-docker)
- [初始化 Linux 数据盘](https://help.aliyun.com/zh/ecs/user-guide/initialize-a-data-disk-whose-size-does-not-exceed-2-tib-on-a-linux-instance/)
- [ESSD 云盘数据可靠性](https://help.aliyun.com/zh/ecs/user-guide/essd-cloud-disk-data-reliability)
- [快照概述](https://help.aliyun.com/zh/ecs/user-guide/snapshot-overview)
- [自动快照策略](https://help.aliyun.com/zh/ecs/user-guide/create-an-automatic-snapshot-policy-1)
- [OSS 存储冗余类型](https://help.aliyun.com/en/oss/user-guide/overview-of-storage-redundancy-types/)
- [OSS 生命周期规则](https://help.aliyun.com/zh/oss/user-guide/overview-54/)
- [OSS 服务端加密](https://help.aliyun.com/en/oss/user-guide/server-side-encryption-8)
- [ECS 安全组](https://help.aliyun.com/zh/ecs/user-guide/start-using-security-groups)
- [DNS A 记录](https://help.aliyun.com/zh/dns/pubz-add-parsing-record)
- [ECS HTTPS](https://help.aliyun.com/zh/ecs/user-guide/ssl)
- [ICP 备案流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)
- [App 备案 FAQ](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/basics-about-icp-filling-for-apps)
