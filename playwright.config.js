const { defineConfig, devices } = require("@playwright/test");

/* The tool needs a real https-like origin: from file:// the browser blocks
   Cache API, IndexedDB and dynamic import, and the model never loads. So
   every browser check runs against a local static server, never the file. */
module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 180000,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/server.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
