import { redirect } from "next/navigation";
import { AppNavigation } from "@/components/AppNavigation";
import { getCurrentUser } from "@/src/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <AppNavigation />
      </header>
      {children}
    </div>
  );
}
