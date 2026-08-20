"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function useRegistrationAvailability() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/registration-status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("status unavailable")))
      .then((body) => {
        if (active) setEnabled(body?.registrationEnabled === true);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => { active = false; };
  }, []);

  return enabled;
}

export function RegistrationEntry() {
  const enabled = useRegistrationAvailability();
  if (!enabled) return null;
  return <p className="auth-alt">还没有账号？ <Link href="/register">去注册</Link></p>;
}
