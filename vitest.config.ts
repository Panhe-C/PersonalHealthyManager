import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, ".worktrees/**", "apps/mobile/**", "apps/mobile/node_modules/**", "packages/contracts/node_modules/**"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
      "@hbm/contracts": new URL("./packages/contracts/src", import.meta.url).pathname
    }
  }
});
