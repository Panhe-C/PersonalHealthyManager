import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setUnauthorizedHandler } from "../api/client";
import { loadTokens, saveTokens, resetTokens, getRefreshToken } from "./tokenStore";

type Status = "loading" | "guest" | "authed";

interface AuthContextValue {
  status: Status;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Creates the account and returns without a session: the server withholds
   * tokens until the email address is verified.
   */
  signUp: (email: string, password: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    setUnauthorizedHandler(() => setStatus("guest"));
    (async () => {
      const tokens = await loadTokens();
      setStatus(tokens ? "authed" : "guest");
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      signIn: async (email, password) => {
        const result = await api.auth.login(email, password);
        await saveTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          accessExpiresAt: result.accessExpiresAt,
          refreshExpiresAt: result.refreshExpiresAt
        });
        setStatus("authed");
      },
      signUp: async (email, password) => {
        await api.auth.register(email, password, Intl.DateTimeFormat().resolvedOptions().timeZone);
      },
      resendVerification: async (email) => {
        await api.auth.resendVerification(email);
      },
      signOut: async () => {
        const refreshToken = getRefreshToken();
        try {
          await api.auth.logout(refreshToken ?? undefined);
        } catch {
          // best-effort: clear locally even if server call fails
        }
        await resetTokens();
        setStatus("guest");
      }
    }),
    [status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Re-export SecureStore-free helper for tests/non-native environments if needed.
export { SecureStore };
