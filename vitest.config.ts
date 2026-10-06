import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": here("./"),
      // Tests run outside React Server Components; the marker package would throw.
      "server-only": here("./tests/support/empty.ts"),
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // One database, so integration files run one at a time.
          fileParallelism: false,
          setupFiles: ["tests/support/db-setup.ts"],
        },
      },
    ],
  },
});
