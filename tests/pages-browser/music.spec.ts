import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.route("https://script.google.com/**", route => route.fulfill({ json: { total: 0, comments: [], guests: [], page: 0, scene: 0 } }));
  await page.route("https://www.google.com/maps/**", route => route.abort());
  await page.goto("./");
}
const musicButton = (page: Page) => page.locator(".wi-music button");

for (const width of [390, 320]) test(`arrival guidance and reachable music control at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await open(page);
  await expect(page.locator(".wi-transit")).toHaveCount(2);
  await expect(page.locator(".wi-transit").first()).toContainText("별도 주차동");
  await expect(page.locator(".wi-transit").last()).toContainText("전주세무서·서곡로타리");
  await expect(page.locator(".wi-transit").last()).toContainText("전주역·고속·시외버스터미널");
  for (const section of ["#location", "#guestbook", ".wi-footer"]) {
    await page.locator(section).scrollIntoViewIfNeeded();
    const controls = page.locator(".wi-dock a, .wi-dock button");
    await expect(controls).toHaveCount(4);
    for (const control of await controls.all()) {
      const box = await control.boundingBox(); expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(40);
      const targetable = await control.evaluate(element => {
        const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      });
      expect(targetable).toBe(true);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("real MP3 stays idle until clicked, decodes, loops and pauses at nested base", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes(".mp3")) requests.push(request.url()); });
  await open(page);
  const audio = page.locator(".wi-music audio"), button = musicButton(page);
  await expect(audio).toHaveAttribute("src", "/invitation/audio/spring-garden.mp3");
  await expect(audio).toHaveAttribute("preload", "none");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(300); expect(requests).toEqual([]);
  expect(await audio.evaluate((media: HTMLAudioElement) => media.autoplay)).toBe(false);
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => audio.evaluate((media: HTMLAudioElement) => media.currentTime)).toBeGreaterThan(0.1);
  expect(await audio.evaluate((media: HTMLAudioElement) => Number.isFinite(media.duration) && media.duration > 0 && media.error === null && media.loop)).toBe(true);
  expect(requests.length).toBeGreaterThan(0); expect(requests.every(url => new URL(url).pathname === "/invitation/audio/spring-garden.mp3")).toBe(true);
  await audio.evaluate((media: HTMLAudioElement) => { media.currentTime = media.duration - 0.2; });
  await expect.poll(() => audio.evaluate((media: HTMLAudioElement) => media.currentTime < media.duration / 2)).toBe(true);
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await audio.evaluate((media: HTMLAudioElement) => media.paused)).toBe(true);
});

test("mocked play rejection and media error keep OFF and allow explicit retry", async ({ page }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (++attempts === 1) return Promise.reject(new DOMException("fixture rejection", "NotAllowedError")); return nativePlay.call(this); };
  });
  await open(page); const button = musicButton(page), audio = page.locator(".wi-music audio");
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".wi-music-status")).toContainText("다시 눌러");
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  await audio.evaluate((media: HTMLAudioElement) => { media.pause(); Object.defineProperty(media, "error", { configurable: true, value: { code: 3 } }); media.dispatchEvent(new Event("error")); });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await audio.evaluate((media: HTMLAudioElement) => {
    const nativeLoad = media.load.bind(media);
    media.load = () => { media.dataset.reloaded = "true"; Object.defineProperty(media, "error", { configurable: true, value: null }); nativeLoad(); };
  });
  await button.click(); await expect(audio).toHaveAttribute("data-reloaded", "true");
  await expect(button).toHaveAttribute("aria-pressed", "true");
});

// Controlled promises isolate event ordering; native decode is covered above.
async function pendingPlay(page: Page) {
  await page.addInitScript(() => {
    const attempts: { resolve: () => void; reject: () => void }[] = [];
    (window as unknown as { musicAttempts: typeof attempts }).musicAttempts = attempts;
    HTMLMediaElement.prototype.play = function () {
      const media = this;
      return new Promise<void>((resolve, reject) => attempts.push({ resolve: () => { media.dispatchEvent(new Event("playing")); resolve(); }, reject: () => reject(new Error("fixture late rejection")) }));
    };
  });
  await open(page);
}
async function finish(page: Page, index: number, action: "resolve" | "reject") {
  await page.evaluate(({ index, action }) => (window as unknown as { musicAttempts: { resolve: () => void; reject: () => void }[] }).musicAttempts[index][action](), { index, action });
}

test("mocked rapid pending cancellation ignores old rejection and old success preserves new intent", async ({ page }) => {
  await pendingPlay(page); const button = musicButton(page);
  await button.click(); await expect(button).toHaveText("음악 취소"); await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click(); await expect(button).toHaveText("음악 켜기");
  await button.click(); await finish(page, 0, "reject"); await expect(button).toHaveText("음악 취소");
  await finish(page, 1, "resolve"); await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click(); await button.click(); await button.click(); await button.click();
  await finish(page, 3, "resolve"); await finish(page, 2, "resolve");
  await expect(button).toHaveAttribute("aria-pressed", "true");
});

test("mocked hidden tab cancels pending intent and late success never resumes", async ({ page }) => {
  await pendingPlay(page); const button = musicButton(page);
  await button.click();
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await finish(page, 0, "resolve");
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(button).toHaveText("음악 켜기"); await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator(".wi-music audio").evaluate((media: HTMLAudioElement) => media.paused)).toBe(true);
});

test("real playing audio stops when hidden and remains OFF on return", async ({ page }) => {
  await open(page); const button = musicButton(page);
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  expect(await page.locator(".wi-music audio").evaluate((media: HTMLAudioElement) => media.paused)).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(button).toHaveText("음악 켜기");
});


test("native interruption updates OFF and one click resumes", async ({ page }) => {
  await open(page); const button = musicButton(page), audio = page.locator(".wi-music audio");
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
  await audio.evaluate((media: HTMLAudioElement) => media.pause());
  await expect(button).toHaveText("음악 켜기"); await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
});
