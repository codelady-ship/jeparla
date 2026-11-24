// Runs before `npm run dev` and `npm run build`. ONNX Runtime Web (the "fit to design" step for
// product photos, src/lib/image-fit) loads its WebAssembly binary and the small loader next to it at
// run time; the bundler does not emit them, so they are copied from node_modules into public/ort/
// (gitignored, ~11 MB, requested only when an admin or seller presses "fit to design"). Always the
// version in package-lock.json.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../node_modules/onnxruntime-web/dist");
const target = resolve(here, "../public/ort");
mkdirSync(target, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) {
  copyFileSync(resolve(dist, file), resolve(target, file));
}
