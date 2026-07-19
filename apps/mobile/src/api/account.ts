import { accountSchema, okResponseSchema, type Account } from "@hbm/contracts";
import { api } from "./client";

export function getAccount() {
  return api.get<Account>("/account", accountSchema);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api.patch<{ ok: true }>("/account", { currentPassword, newPassword }, okResponseSchema);
}

export function deleteAccount(password: string) {
  return api.deleteWithBody<{ ok: true }>("/account", { password }, okResponseSchema);
}

export function registerPushToken(token: string, platform: string) {
  return api.post<{ ok: true; id: string }>("/push/register", { token, platform });
}
