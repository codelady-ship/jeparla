/**
 * Browser side of "fit to design": decode the photo, find the item with the segmentation model
 * (ONNX Runtime Web, CPU/WebAssembly, on this device: the photo never leaves the browser for this
 * step), compose it with ./compose and encode a WebP.
 *
 * ONNX Runtime (MIT) and the 4.6 MB model are loaded only here, on the first call, through a
 * dynamic import: public pages never load them (Lighthouse script budget). Callers import this
 * module itself lazily too (`await import("@/lib/image-fit/fit")`).
 */
import { compose, FIT_OUTPUT, workSize } from "./compose";
import { MODEL, normalize, sha256Hex, toTensor, upscale } from "./tensor";

export { NoItemError } from "./compose";

type Ort = typeof import("onnxruntime-web/wasm");
type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;

/** Folder of the runtime files in public/ (scripts/copy-ort.mjs). */
const ORT_DIR = "/ort/";

let session: Promise<{ ort: Ort; session: Session }> | null = null;

/** The model check failed: the file on the server is not the pinned one. */
export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}

function loadSession() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    // One thread: SharedArrayBuffer needs cross-origin isolation, which the site does not set.
    ort.env.wasm.numThreads = 1;
    // The binary and its loader are served from public/ort/, not from the bundler output.
    ort.env.wasm.wasmPaths = new URL(ORT_DIR, location.origin).href;
    const res = await fetch(MODEL.url);
    if (!res.ok) throw new ModelError(`Model download failed: ${res.status}`);
    const bytes = await res.arrayBuffer();
    if ((await sha256Hex(bytes)) !== MODEL.sha256) throw new ModelError("Model hash mismatch");
    const s = await ort.InferenceSession.create(new Uint8Array(bytes), {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    return { ort, session: s };
  })().catch((e: unknown) => {
    session = null;
    throw e;
  });
  return session;
}

/** Draws `source` into a `w x h` canvas and returns its pixels. */
function pixels(source: CanvasImageSource, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Soft item mask (0..1) for a `w x h` work photo. */
async function segment(bitmap: ImageBitmap, w: number, h: number): Promise<Float32Array> {
  const { ort, session: s } = await loadSession();
  const size = MODEL.size;
  const input = new ort.Tensor("float32", toTensor(pixels(bitmap, size, size), size), [
    1,
    3,
    size,
    size,
  ]);
  const result = await s.run({ [s.inputNames[0]]: input });
  const out = result[s.outputNames[0]];
  const small = normalize((out.data as Float32Array).subarray(0, size * size));
  input.dispose();
  for (const t of Object.values(result)) t.dispose();
  return upscale(small, size, w, h);
}

export type FitResult = { blob: Blob; width: number; height: number };

/** Loads the model ahead of the first photo (for example when the panel opens). */
export function warmUp(): Promise<void> {
  return loadSession().then(() => undefined);
}

/**
 * The fitted product photo as a WebP (800 x 1000 by default, the card ratio). Throws NoItemError
 * when no item is found and ModelError when the model cannot be loaded.
 */
export async function fitToDesign(
  file: Blob,
  size: { width: number; height: number } = FIT_OUTPUT,
  quality = 0.9,
): Promise<FitResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const work = workSize(bitmap.width, bitmap.height);
    const rgba = pixels(bitmap, work.width, work.height);
    const mask = await segment(bitmap, work.width, work.height);
    // The composition is a few hundred ms of plain JS; yield once so the spinner keeps turning.
    await new Promise((r) => setTimeout(r, 0));
    const out = compose(rgba, mask, work.width, work.height, size);
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
    const encode = (type: string) =>
      new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
    let blob = await encode("image/webp");
    // A browser without a WebP encoder (older Safari) returns a PNG: a JPEG is far smaller.
    if (blob && blob.type !== "image/webp") blob = await encode("image/jpeg");
    if (!blob) throw new Error("encode");
    return { blob, width: out.width, height: out.height };
  } finally {
    bitmap.close();
  }
}
