import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000", storageState: "tests/e2e/.auth/state.json" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true },
});
