import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  // "server-only" throws outside a React server build; in unit tests it is an empty module.
  resolve: { alias: { "@": path.resolve(__dirname, "./src"), "server-only": path.resolve(__dirname, "./src/test/server-only.ts") } },
});
