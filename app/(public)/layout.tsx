import Link from "next/link";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="public-shell">
      <div className="public-card">
        <header className="public-header">
          <span className="eyebrow">Healthy Body Manager</span>
          <Link href="/login" className="public-back">返回登录</Link>
        </header>
        {children}
      </div>
    </main>
  );
}
