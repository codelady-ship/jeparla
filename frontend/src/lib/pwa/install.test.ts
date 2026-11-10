import { describe, expect, it } from "vitest";
import {
  coversAny,
  deviceKind,
  dismiss,
  isDismissed,
  isEngaged,
  isInstalled,
  isIosSafari,
  isStandalone,
  KEYS,
  markInstalled,
  offerFor,
  productSlug,
  recordProductView,
  recordVisit,
  type KeyValueStore,
} from "./install";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

/** Storage that throws on every access, like Safari with blocked site data. */
const broken: KeyValueStore = {
  getItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("denied", "SecurityError");
  },
};

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

describe("engagement counter", () => {
  it("counts one visit per browser session", () => {
    const local = memory();
    const session = memory();
    expect(recordVisit(local, session)).toBe(1);
    expect(recordVisit(local, session)).toBe(1);
    expect(isEngaged(local)).toBe(false);
    // A new session is the second visit.
    expect(recordVisit(local, memory())).toBe(2);
    expect(isEngaged(local)).toBe(true);
  });

  it("is engaged after two different product pages, not the same one twice", () => {
    const local = memory();
    expect(recordProductView(local, "ring")).toBe(1);
    expect(recordProductView(local, "ring")).toBe(1);
    expect(isEngaged(local)).toBe(false);
    expect(recordProductView(local, "chain")).toBe(2);
    expect(isEngaged(local)).toBe(true);
  });

  it("does not count visits when the session cannot be stored", () => {
    const local = memory();
    expect(recordVisit(local, broken)).toBe(0);
    expect(recordVisit(local, broken)).toBe(0);
    expect(isEngaged(local)).toBe(false);
  });

  it("survives corrupt or blocked storage", () => {
    const local = memory();
    local.setItem(KEYS.products, "{not json");
    local.setItem(KEYS.visits, "many");
    expect(isEngaged(local)).toBe(false);
    expect(recordProductView(local, "ring")).toBe(1);
    expect(() => recordVisit(broken, broken)).not.toThrow();
    expect(isEngaged(broken)).toBe(false);
    expect(isEngaged(null)).toBe(false);
  });
});

describe("dismissal and installation", () => {
  it("remembers a dismissal", () => {
    const local = memory();
    expect(isDismissed(local)).toBe(false);
    dismiss(local);
    expect(isDismissed(local)).toBe(true);
  });

  it("remembers an installation", () => {
    const local = memory();
    markInstalled(local);
    expect(isInstalled(local)).toBe(true);
    expect(() => markInstalled(broken)).not.toThrow();
  });

  it("detects the installed app by display mode or iOS standalone", () => {
    const win = (standalone: boolean, iosStandalone?: boolean) => ({
      matchMedia: (q: string) => ({ matches: standalone && q.includes("standalone") }),
      navigator: { standalone: iosStandalone } as Navigator & { standalone?: boolean },
    });
    expect(isStandalone(win(true) as never)).toBe(true);
    expect(isStandalone(win(false, true) as never)).toBe(true);
    expect(isStandalone(win(false) as never)).toBe(false);
  });
});

describe("platform", () => {
  it("offers the iOS steps in Safari only", () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 0)).toBe(false);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(IPHONE_INSTAGRAM)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
  });

  it("reads product slugs from localized paths", () => {
    expect(productSlug("/az/products/qizil-uzuk")).toBe("qizil-uzuk");
    expect(productSlug("/ru/products/s%C4%B1r%C4%9Fa/")).toBe("sırğa");
    expect(productSlug("/az/products")).toBeNull();
    expect(productSlug("/az/stores/ayzer")).toBeNull();
  });
});

describe("offerFor", () => {
  const base = {
    engaged: true,
    dismissed: false,
    installed: false,
    standalone: false,
    canPrompt: false,
    iosSafari: false,
  };

  it("offers the install dialog when the browser allows it", () => {
    expect(offerFor({ ...base, canPrompt: true })).toBe("prompt");
  });

  it("offers the iOS steps in Safari", () => {
    expect(offerFor({ ...base, iosSafari: true })).toBe("ios");
  });

  it("offers nothing on desktop browsers that cannot install", () => {
    expect(offerFor(base)).toBeNull();
  });

  it.each([
    ["before engagement", { engaged: false }],
    ["after a dismissal", { dismissed: true }],
    ["once installed", { installed: true }],
    ["inside the installed app", { standalone: true }],
  ])("offers nothing %s", (_, patch) => {
    expect(offerFor({ ...base, canPrompt: true, iosSafari: true, ...patch })).toBeNull();
  });
});

describe("deviceKind", () => {
  it("speaks to a computer when the main pointer is fine", () => {
    expect(deviceKind(false, 1440, 900)).toBe("desktop");
    expect(deviceKind(false, 390, 844)).toBe("desktop");
  });
  it("tells phones from tablets by the short side, in both orientations", () => {
    expect(deviceKind(true, 390, 844)).toBe("phone");
    expect(deviceKind(true, 844, 390)).toBe("phone");
    expect(deviceKind(true, 834, 1194)).toBe("tablet");
    expect(deviceKind(true, 1194, 834)).toBe("tablet");
  });
});

describe("coversAny", () => {
  const card = { top: 600, right: 380, bottom: 800, left: 10 };
  it("sees a primary action under the card or right next to it", () => {
    expect(coversAny(card, [{ top: 640, right: 370, bottom: 684, left: 280 }])).toBe(true);
    expect(coversAny(card, [{ top: 560, right: 370, bottom: 596, left: 280 }])).toBe(true);
  });
  it("lets the card show when the actions are clear of it", () => {
    expect(coversAny(card, [{ top: 100, right: 370, bottom: 144, left: 280 }])).toBe(false);
    expect(coversAny(card, [{ top: 640, right: 900, bottom: 684, left: 400 }])).toBe(false);
  });
  it("ignores hidden (empty) elements", () => {
    expect(coversAny(card, [{ top: 0, right: 0, bottom: 0, left: 0 }])).toBe(false);
    expect(coversAny(card, [])).toBe(false);
  });
});
