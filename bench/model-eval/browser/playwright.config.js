/* The browser check (PLAN.md Phase 5, finalists only). Its own config so it never runs in
   npm test: it loads a real model, and one row takes minutes.

     PIB_MODEL=parse-base-ft npx playwright test -c bench/model-eval/browser

   The server is the repository's own e2e/server.js, started from the repository root. */
const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const ROOT = path.join(__dirname, "..", "..", "..");
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /browser\.spec\.js$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["line"]],
  timeout: 3600000,
  // the page's CSP rightly refuses the local model server the harness redirects the hub to;
  // the check measures the model, not the policy (e2e/ tests the policy)
  use: { baseURL: "http://127.0.0.1:4173", bypassCSP: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/server.js",
    cwd: ROOT,
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
