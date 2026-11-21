import type { Page } from "@playwright/test";
import { expect, expectNoA11yViolations, isPhone, test, waitForHydration } from "./fixtures";

/**
 * The short product video (#117). Sample product 2 has one (a free stock clip, docs/credits.md);
 * product 1 has none. The clip is never requested before the buyer presses play, on the product
 * page or on a card. Playback itself is not asserted: the test browser has no H.264 decoder, so
 * the checks are what the page puts in the document and what it asks the network for.
 */
const WITH_VIDEO = "/az/products/toy-uzukleri-silver-925-2";
const WITHOUT_VIDEO = "/az/products/nisan-uzukleri-gold-585-1";
const STORE = "/az/stores/lale-atelye";
const PLAY = /^Videonu oynat: /;

/** Every request for a video file the page makes, from now on. */
function videoRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "media" || /\.(mp4|webm)(\?|$)/.test(req.url()))
      urls.push(req.url());
  });
  return urls;
}

/** Counts play() and pause() calls of any media element, before the page scripts run. */
async function countPlayback(page: Page) {
  await page.addInitScript(() => {
    const calls = { play: 0, pause: 0 };
    (window as unknown as { __media: typeof calls }).__media = calls;
    const { play, pause } = HTMLMediaElement.prototype;
    HTMLMediaElement.prototype.play = function () {
      calls.play++;
      return play.call(this);
    };
    HTMLMediaElement.prototype.pause = function () {
      calls.pause++;
      return pause.call(this);
    };
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __media: { play: number; pause: number } }).__media,
    );
}

/** Brings the video frame into view: on a phone it is the second frame of the swipe carousel. */
async function showVideoFrame(page: Page) {
  if (!isPhone(page)) return;
  const carousel = page.locator("[aria-roledescription=carousel]");
  await waitForHydration(carousel);
  await carousel.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 300, clientY: 300 });
  await carousel.dispatchEvent("pointerup", { pointerType: "touch", clientX: 100, clientY: 300 });
}

test.describe("product video", () => {
  test("nothing of the video loads before play; then a muted player with controls", async ({
    page,
  }) => {
    const requests = videoRequests(page);
    const calls = await countPlayback(page);
    await page.goto(WITH_VIDEO);
    await page.waitForLoadState("networkidle");
    await showVideoFrame(page);

    const play = page.getByRole("button", { name: PLAY });
    await expect(play).toBeVisible();
    // The badge of the frame says how long the clip is.
    await expect(page.getByText("0:08").locator("visible=true")).toHaveCount(1);
    // No player, no source, no request, nothing started: only a poster and a button.
    await expect(page.locator("video, source")).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(await calls()).toEqual({ play: 0, pause: 0 });
    await expectNoA11yViolations(page);

    // The keyboard reaches the button like any other control.
    await play.focus();
    await page.keyboard.press("Enter");

    const video = page.locator("video");
    await expect(video).toHaveCount(1);
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("preload", "none");
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("playsinline", "");
    await expect(video).toHaveAttribute("aria-label", /qısa video, səssiz$/);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(video.locator("source")).toHaveAttribute("src", "/demo/ring-video.mp4");
    await expect(video.locator("source")).toHaveAttribute("type", "video/mp4");
    // The tests run with reduced motion: the clip plays once the visitor asked, but does not loop.
    expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(false);

    // Started by that key press, and the player holds the focus: the space bar toggles it.
    await expect(video).toBeFocused();
    await expect.poll(async () => (await calls()).play).toBe(1);
    await page.keyboard.press("Space");
    await expect.poll(async () => (await calls()).play + (await calls()).pause).toBe(2);
    await expectNoA11yViolations(page);
  });

  test("loops for a visitor without the reduced motion setting", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const calls = await countPlayback(page);
    await page.goto(WITH_VIDEO);
    await page.waitForLoadState("networkidle");
    // Still nothing by itself: motion is allowed, autoplay is not.
    await expect(page.locator("video")).toHaveCount(0);
    expect(await calls()).toEqual({ play: 0, pause: 0 });
    await showVideoFrame(page);
    await page.getByRole("button", { name: PLAY }).click();
    const video = page.locator("video");
    await expect(video).toHaveCount(1);
    expect(await video.evaluate((v: HTMLVideoElement) => v.loop)).toBe(true);
  });

  test.describe("with Save-Data", () => {
    test.use({ extraHTTPHeaders: { "Save-Data": "on" } });

    test("no video bytes without asking", async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "connection", {
          value: { saveData: true, effectiveType: "2g" },
          configurable: true,
        });
      });
      const requests = videoRequests(page);
      await page.goto(WITH_VIDEO);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => "connection" in navigator)).toBe(true);
      await expect(page.locator("video, source")).toHaveCount(0);
      expect(requests).toEqual([]);
    });
  });

  test("a product without a video has no video frame and no gap", async ({ page }) => {
    await page.goto(WITHOUT_VIDEO);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('button[aria-label^="Videonu oynat"]')).toHaveCount(0);
    await expect(page.locator("video")).toHaveCount(0);
    // Every frame of the gallery is a photo: no empty cell where a video would be.
    const gallery = page.locator("[data-gallery]");
    const cells = gallery.locator("ul > li");
    await expect(cells.first()).toBeAttached();
    expect(await cells.count()).toBe(await gallery.locator("ul > li > button img").count());
    const frames = gallery.locator("[aria-roledescription=carousel] > div[aria-hidden]");
    expect(await frames.count()).toBe(await cells.count());
  });

  test("a card only marks the video and never loads it", async ({ page }) => {
    const requests = videoRequests(page);
    await page.goto(STORE);
    await page.waitForLoadState("networkidle");
    const card = page.locator("article", { hasText: "Nur — gümüş toy üzüyü 925" }).first();
    await expect(card.getByText("Video var")).toBeAttached();
    await expect(page.locator("video, source")).toHaveCount(0);
    expect(requests).toEqual([]);
  });
});
