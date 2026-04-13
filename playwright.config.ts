import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 300_000,
  retries: 1,
  workers: 2,
  outputDir: "reports/playwright/test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/playwright/html", open: "never" }],
    ["json", { outputFile: "reports/playwright/results.json" }],
    ["junit", { outputFile: "reports/playwright/junit.xml" }],
  ],
  use: {
    baseURL: "http://localhost:3050",
  },
  webServer: {
    command: "yarn dev",
    url: "http://localhost:3050",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
