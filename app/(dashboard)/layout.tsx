import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/src/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <nav className="page app-nav" aria-label="Primary navigation">
          <Link className="brand" href="/plan">
            <span className="brand-mark">
              <Activity aria-hidden="true" size={17} />
            </span>
            <span>Healthy Body Manager</span>
          </Link>
          <Link className="nav-link" href="/plan">
            Plan
          </Link>
          <Link className="nav-link" href="/profile">
            Profile
          </Link>
          <Link className="nav-link" href="/goals">
            Goals
          </Link>
          <Link className="nav-link" href="/agent">
            Agent
          </Link>
          <LogoutButton />
        </nav>
      </header>
      {children}
    </div>
  );
}
