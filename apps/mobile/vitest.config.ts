import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@hbm/contracts": new URL("../../packages/contracts/src", import.meta.url).pathname,
      "@hbm/contracts/*": new URL("../../packages/contracts/src/*", import.meta.url).pathname
    }
  }
});
