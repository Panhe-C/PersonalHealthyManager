"use client";

import React from "react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, CalendarDays, SlidersHorizontal, Target, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal }
];

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="page app-nav" aria-label="Primary navigation">
      <Link className="brand" href="/plan">
        <span className="brand-mark">
          <Activity aria-hidden="true" size={17} />
        </span>
        <span>Healthy Body Manager</span>
      </Link>
      <div className="nav-links">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={clsx("nav-link", active && "nav-link-active")}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
      <LogoutButton />
    </nav>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="mobile-tab-bar" aria-label="Primary navigation">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={clsx("mobile-tab-link", active && "mobile-tab-link-active")}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
