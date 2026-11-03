// Lighthouse CI (issue #60, PLAN 5.18). Mobile is the main profile; desktop uses
// LHCI_PRESET=desktop. Each page runs 3 times and the median is asserted.
const desktop = process.env.LHCI_PRESET === "desktop";
const base = "http://localhost:3100";
const pages = [
  "/az",
  "/az/products",
  "/az/products/toy-uzukleri-silver-925-2",
  "/az/stores/ayzer-zerger",
  "/az/categories/uzukler",
];

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3100",
      startServerReadyPattern: "Ready",
      url: pages.map((p) => base + p),
      numberOfRuns: 3,
      settings: {
        ...(desktop && { preset: "desktop" }),
        // Demo and product pages are noindex while mock data is on; SEO is asserted
        // without that audit so the score reflects what will ship with real data.
        skipAudits: ["is-crawlable"],
        chromeFlags: "--no-sandbox --headless=new",
      },
    },
    assert: {
      // PLAN 5.18: mobile performance >= 90, desktop >= 95 (the aim is 95+ everywhere;
      // the mobile gate is 90 because simulated runs vary by 3-5 points). Measured
      // 2026-11-03 after moving body text to the system font: home 90, catalog 92,
      // product 93; accessibility, best practices and SEO 100.
      assertions: {
        "categories:performance": ["error", { minScore: desktop ? 0.95 : 0.9 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 1 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: desktop ? 1500 : 2000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }],
        "total-blocking-time": ["warn", { maxNumericValue: 150 }],
        // Budget: first-load JS (transfer size) and font files per page.
        "resource-summary:script:size": ["error", { maxNumericValue: 250 * 1024 }],
        "resource-summary:font:count": ["error", { maxNumericValue: 2 }],
        "errors-in-console": ["error", { maxLength: 0 }],
      },
    },
    upload: { target: "temporary-public-storage" },
  },
};
