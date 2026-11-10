// Contract fixtures for CatalogContractTests (#37): what the frontend mock API returns for the demo
// catalog, next to the exact request the frontend REST client (frontend/src/lib/api/http.ts) sends
// for the same call. The backend must answer that request, on the demo seed (same data as
// frontend/src/lib/api/mock/fixtures.ts), with JSON of the same shape and the same values.
//
// Run from the repository root after changing the frontend types, the mock or the demo data:
//
//   node backend/src/test/resources/contract/generate.mjs
//
// Needs Node 23.6+ (TypeScript type stripping) and frontend/node_modules (npm ci in frontend/; only
// big.js is loaded). In a git worktree without node_modules, point to another checkout:
//   JEPARLA_FRONTEND_NODE_MODULES=/path/to/jeparla/frontend/node_modules node .../generate.mjs
//
// Output: backend/src/test/resources/contract/catalog-cases.json (deterministic, committed).
import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../../..");
const src = path.join(root, "frontend", "src");
const nodeModules = process.env.JEPARLA_FRONTEND_NODE_MODULES ?? path.join(root, "frontend", "node_modules");

// Resolve the frontend's "@/..." alias and extensionless relative imports to .ts files, and bare
// packages (big.js) from frontend/node_modules.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
    const firstFile = (base) => candidates(base).find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
    if (specifier.startsWith("@/")) {
      const file = firstFile(path.join(src, specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const file = firstFile(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if (!specifier.startsWith(".") && !specifier.startsWith("node:") && !specifier.includes(":")) {
      const parentURL = pathToFileURL(path.join(path.dirname(nodeModules), "package.json")).href;
      return nextResolve(specifier, { ...context, parentURL });
    }
    return nextResolve(specifier, context);
  },
});

const { mockApi } = await import(pathToFileURL(path.join(src, "lib/api/mock/index.ts")).href);
const { httpApi } = await import(pathToFileURL(path.join(src, "lib/api/http.ts")).href);
const { PRODUCTS } = await import(pathToFileURL(path.join(src, "lib/api/mock/fixtures.ts")).href);

// The request httpApi sends for a call: fetch is replaced by a recorder.
async function requestOf(call) {
  let url = null;
  globalThis.fetch = async (u) => {
    url = String(u);
    return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  await call(httpApi);
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
}

/**
 * compare: "values" = same shape and values (decimals compared numerically, date-times as
 * instants); "unordered" = the same, but the result groups are compared as sets (search ranks them,
 * the mock does not); "shape" = same keys and JSON types only (data that differs on purpose, listed in
 * backend/src/test/java/az/jeparla/contract/CatalogContractTests.java).
 */
const cases = [];
async function add(name, call, { status = 200, compare = "values" } = {}) {
  const request = await requestOf(call);
  const result = await call(mockApi);
  cases.push({ name, request, status, compare, mock: result ?? null });
}

const slugOf = (index) => PRODUCTS[index].slug;

// Products: filters, sorts and pagination edges (ProductFilters).
await add("products default", (api) => api.listProducts());
await add("products page 2 of 10, price ascending", (api) => api.listProducts({ sort: "price_asc", page: 1, size: 10 }));
await add("products price descending", (api) => api.listProducts({ sort: "price_desc", size: 12 }));
await add("products weight ascending", (api) => api.listProducts({ sort: "weight_asc", size: 12 }));
await add("products newest", (api) => api.listProducts({ sort: "newest", size: 12 }));
await add("products last page", (api) => api.listProducts({ page: 2 }));
await add("products after the last page", (api) => api.listProducts({ page: 5 }));
await add("products of a root category with subcategories", (api) => api.listProducts({ category: "uzukler", size: 50 }));
await add("products of an unknown category", (api) => api.listProducts({ category: "no-such-category" }));
await add("products of two stores, gold 585 or 750", (api) =>
  api.listProducts({ store: ["ayzer-zerger", "lale-atelye"], metal: "GOLD", fineness: [585, 750], size: 50 }),
);
await add("products by weight and price range", (api) =>
  api.listProducts({ minWeight: "3", maxWeight: "6.5", minPrice: "300", maxPrice: "1500", sort: "price_asc", size: 50 }),
);
await add("products in Baku that can be bought", (api) => api.listProducts({ city: "Bakı", inStock: true, size: 50 }));
await add("products with round or oval diamonds of colour F from 0.2 ct", (api) =>
  api.listProducts({ shape: ["ROUND", "OVAL"], color: ["F"], minCarat: "0.2", size: 50 }),
);
await add("products with SI1 diamonds up to 0.5 ct", (api) =>
  api.listProducts({ clarity: ["SI1"], maxCarat: "0.5", size: 50 }),
);
await add("products of platinum", (api) => api.listProducts({ metal: "PLATINUM" }));
await add("products matching a word", (api) => api.listProducts({ q: "leyla", size: 50 }));

// Favorites and compare.
await add("products by ids", (api) => api.getProductsByIds([3, 1, 999, 2]));
await add("compare items", (api) => api.getCompareItems([20, 10, 99990]));

// Product page: a ring with a diamond, a FIXED price, a product with two photos, a silver one.
await add("product with a diamond", (api) => api.getProduct(slugOf(0)));
await add("product with a fixed price", (api) => api.getProduct(slugOf(2)));
await add("product with two photos", (api) => api.getProduct(slugOf(3)));
await add("silver product", (api) => api.getProduct(slugOf(1)));
await add("unknown product", (api) => api.getProduct("no-such-product"), { status: 404 });

// Categories, finenesses, stores.
await add("categories", (api) => api.listCategories());
await add("finenesses", (api) => api.listFinenesses());
await add("stores", (api) => api.listStores());
await add("stores of a city", (api) => api.listStores({ city: "Bakı" }));
await add("stores matching a word", (api) => api.listStores({ q: "zerger" }));
await add("store page", (api) => api.getStore("ayzer-zerger"));
await add("unknown store", (api) => api.getStore("no-such-store"), { status: 404 });
await add("store products by price", (api) => api.listStoreProducts("lale-atelye", { sort: "price_asc" }));

// Search (#38). The API ranks every group (best first) while the mock keeps the catalog order, so
// "unordered" compares the groups as sets (sorted by id or slug on both sides). The cases use
// queries where the mock's word-start match and the API's ranked, typo-tolerant match find the same
// items; typo, synonym and Russian matches the mock cannot do are tested in SearchApiTests.
await add("search a store by its name", (api) => api.search("Ayzər"), { compare: "unordered" });
await add("search a category word", (api) => api.search("sırğa"), { compare: "unordered" });
await add("search a word without diacritics", (api) => api.search("nisan"), { compare: "unordered" });
await add("search stores only", (api) => api.search("zərgər", "stores"), { compare: "unordered" });
await add("search categories only", (api) => api.search("üzük", "categories"), { compare: "unordered" });
await add("search products only, after the last page", (api) => api.search("Ayzər", "products", 1));
await add("search without a match", (api) => api.search("zzzqqq"));
await add("search with a blank query", (api) => api.search(""));
await add("suggest a store", (api) => api.suggest("Ayzər"));
await add("suggest a category", (api) => api.suggest("toy"));
await add("suggest a blank query", (api) => api.suggest(""));
await add("suggest more than five products", (api) => api.suggest("sırğa"), { compare: "shape" });

// Metal prices: the demo seed has only the latest day; the mock has 30 days of history.
await add("latest metal prices", (api) => api.latestMetalPrices());
await add("gold price history", (api) => api.metalPriceHistory("GOLD", 30), { compare: "shape" });

const out = path.join(here, "catalog-cases.json");
fs.writeFileSync(out, `${JSON.stringify({ generatedBy: "backend/src/test/resources/contract/generate.mjs", cases }, null, 2)}\n`);
console.log(`${cases.length} cases written to ${path.relative(root, out)}`);
