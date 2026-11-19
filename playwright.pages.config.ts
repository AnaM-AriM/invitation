import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/pages-browser", fullyParallel: false, workers: 1, timeout: 45000,
  reporter: [["list"], ["json", { outputFile: "outputs/pages/browser-results.json" }]], outputDir: "outputs/pages/playwright",
  use: { baseURL: "http://127.0.0.1:4180/invitation/", channel: "chrome", viewport: { width: 390, height: 844 }, launchOptions: { args: ["--no-sandbox"] }, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "PAGES_BASE_PATH=/invitation/ VITE_GUESTBOOK_URL=https://script.google.com/macros/s/fixture/exec npm run dev:pages -- --port 4180 --strictPort", url: "http://127.0.0.1:4180/invitation/", reuseExistingServer: false },
});
