import path from "node:path";

export const AUTOMATION_LABEL = "com.healthybodymanager.automation";

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

export function createAutomationLaunchAgent({ projectRoot, nodePath, logDirectory }) {
  const argumentsList = [
    nodePath,
    `--env-file=${path.join(projectRoot, ".env")}`,
    "--import",
    "tsx",
    path.join(projectRoot, "scripts/run-automations.ts"),
    "--watch",
  ];
  const stdoutPath = path.join(logDirectory, "automation.log");
  const stderrPath = path.join(logDirectory, "automation.error.log");
  const executablePath = [path.dirname(nodePath), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AUTOMATION_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argumentsList.map(xmlString).join("\n")}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(projectRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${escapeXml(executablePath)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${escapeXml(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(stderrPath)}</string>
</dict>
</plist>
`;
}
