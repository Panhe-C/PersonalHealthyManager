import path from "node:path";

export const BACKUP_LABEL = "com.healthybodymanager.backup";

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlString(value) {
  return `    <string>${escapeXml(value)}</string>`;
}

/**
 * Daily SQLite backup + prune. Interval defaults to 24h; override with
 * HBM_BACKUP_INTERVAL_SECONDS when generating the plist.
 */
export function createBackupLaunchAgent({ projectRoot, nodePath, logDirectory, intervalSeconds = 86_400 }) {
  const backupDir = path.join(projectRoot, "backups");
  const argumentsList = [
    "/bin/bash",
    "-lc",
    [
      `cd ${JSON.stringify(projectRoot)}`,
      `${JSON.stringify(nodePath)} --env-file=.env scripts/data-backup.mjs ${JSON.stringify(backupDir)}`,
      `${JSON.stringify(nodePath)} scripts/data-backup-prune.mjs ${JSON.stringify(backupDir)}`
    ].join(" && ")
  ];
  const stdoutPath = path.join(logDirectory, "backup.log");
  const stderrPath = path.join(logDirectory, "backup.error.log");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${BACKUP_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argumentsList.map(xmlString).join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(projectRoot)}</string>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(stderrPath)}</string>
</dict>
</plist>
`;
}
