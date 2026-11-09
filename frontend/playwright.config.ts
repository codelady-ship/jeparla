import { defineConfig, devices } from "@playwright/test";

/**
 * E2E and a11y tests (e2e/). They run against a production build:
 * `npm run build && npm run e2e`. Two viewports, as in the plan: phone (390px) and desktop (1440px).
 */
const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // The hero and reveals follow the OS setting; reduced motion keeps screenshots and axe stable.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // Not `npx`: on Windows the npx wrapper survives the teardown and the run never ends.
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/az`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
