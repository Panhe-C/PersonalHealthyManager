export function isRegistrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = env.HBM_REGISTRATION_ENABLED?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return env.NODE_ENV !== "production";
}
