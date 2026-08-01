# 备份与恢复

## 日常备份

```bash
npm run data:backup                 # 本地 backups/，带 SHA-256 清单
npm run data:backup:prune           # 按 HBM_BACKUP_RETENTION_DAYS（默认 14）清理
```

设置 `HBM_BACKUP_OFFSITE_DIR` 后，成功备份会再拷一份到异地目录。

macOS 定时：

```bash
npm run backup:service -- install   # LaunchAgent，默认每 24h
npm run backup:service -- status
npm run backup:service -- uninstall
```

间隔可用 `HBM_BACKUP_INTERVAL_SECONDS` 覆盖。

## 恢复演练

```bash
npm run data:drill                  # 备份 → 校验 → 隔离恢复，写报告到 backups/drill-reports/
# npm run data:drill -- --destructive   # 额外对线上库做一次真实 restore（会保留 pre-restore 副本）
```

报告字段包含耗时（RTO 参考）与「损失窗口 = 距上次成功备份的时间」（RPO 参考）。

## 真实恢复

```bash
npm run data:restore -- --from backups/healthy-body-….sqlite --confirm
```

恢复前会把当前库拷到 `backups/pre-restore-…/`。
