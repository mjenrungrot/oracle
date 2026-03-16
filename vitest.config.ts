import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup-env.ts", "tests/cli/runOracle/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/live/**",
      "tests/mcp*.test.ts",
      "tests/mcp/**",
      "tests/gemini*.test.ts",
      "tests/gemini-web/**",
      "tests/browser/geminiDeepThinkDomProvider.test.ts",
      "tests/openrouter.test.ts",
      "tests/oracle/claude.test.ts",
      "tests/oracle/multiModelRunner.test.ts",
      "tests/cli/runOracle/**",
      "tests/oracle/clientFactory.test.ts",
      "tests/cli/browserSearchNote.test.ts",
      "tests/cli/sessionRunner.test.ts",
      "tests/cli/integrationCli.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      all: true,
      // Measure the real TypeScript sources (the repo doesn’t ship .js in src).
      include: ["src/**/*.ts"],
      // Exclude interactive/IPC entrypoints that aren’t practical to unit test.
      exclude: [
        "src/cli/tui/**",
        "src/remote/**",
        "src/mcp/**",
        "src/browser/actions/**",
        "src/browser/index.ts",
        "src/browser/pageActions.ts",
        "src/browser/chromeLifecycle.ts",
        "src/browserMode.ts",
        "src/oracle.ts",
        "src/oracle/modelRunner.ts",
        "src/oracle/stringifier.ts",
        "src/oracle/types.ts",
        "src/types/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@src": fileURLToPath(new URL("./src", import.meta.url)),
      "@tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
});
