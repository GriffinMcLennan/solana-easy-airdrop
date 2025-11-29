import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 60000, // Solana transactions need time
    hookTimeout: 120000, // Validator startup
    globalSetup: "./__tests__/setup/globalSetup.ts",
    globalTeardown: "./__tests__/setup/globalTeardown.ts",
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run tests serially for validator sharing
      },
    },
  },
});
