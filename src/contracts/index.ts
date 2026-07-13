// Single source of truth lives in `packages/contracts` (shared with the RN app).
// The backend re-exports it here so existing `@/src/contracts` imports keep working.
export * from "@hbm/contracts";
