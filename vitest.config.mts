import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Pure value-function tests — no DOM needed. tsconfig `paths` aliases
// (@/lib/snap-cn-ui, @/components/snap-cn/*, …) are resolved by the
// vite-tsconfig-paths plugin so tests import exactly what the app imports.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws outside a React Server Component graph — see stub.
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: "node",
    include: [
      "app/**/__tests__/**/*.test.ts",
      "lib/**/__tests__/**/*.test.ts",
      "registry/**/__tests__/**/*.test.ts",
      "scripts/**/__tests__/**/*.test.ts",
    ],
  },
});
