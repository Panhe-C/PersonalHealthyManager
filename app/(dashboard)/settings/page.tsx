import { SettingsForm } from "@/components/SettingsForm";
import { AccountSettings } from "@/components/AccountSettings";
import { requireUser } from "@/src/auth/session";
import { getUserAccount } from "@/src/services/accountService";
import { loadUserSettings } from "@/src/settings/service";

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, account] = await Promise.all([loadUserSettings(user.id), getUserAccount(user.id)]);

  return (
    <main className="page grid" style={{ gap: 20 }}>
      <div className="page-header">
        <div>
          <span className="eyebrow">Runtime configuration</span>
          <h1>Settings</h1>
          <p className="page-subtitle">Configure model access, API keys, and data MCP connections.</p>
        </div>
      </div>
      <AccountSettings email={account.email} timezone={account.timezone} />
      <SettingsForm initialSettings={settings} />
    </main>
  );
}
