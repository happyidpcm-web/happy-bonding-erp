import { defineConfig, devices } from "@playwright/test";

// These tests intercept every API call and never write to a real billing database.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "sales-save.spec.ts",
  use: { baseURL: "http://127.0.0.1:5178" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
