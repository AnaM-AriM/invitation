import { expect, test } from "@playwright/test";

test("illustrated cover paints three garden lights and respects reduced motion", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: Record<string, unknown>) {
      return Reflect.apply(original, this, [type, type === "webgl2" ? { ...options, preserveDrawingBuffer: true } : options]);
    } as typeof original;
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  const canvas = page.locator(".wi-garden-canvas");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  expect(await canvas.evaluate((element: HTMLCanvasElement) => !!element.getContext("webgl2"))).toBe(true);
  const pixels = () => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const skyColor = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const sample = document.createElement("canvas");
    sample.width = sample.height = 1;
    const ctx = sample.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(element, element.width * .45, element.height * .08, element.width * .1, element.height * .05, 0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data);
  });
  const morning = await pixels();
  const [dayRed, dayGreen, dayBlue] = await skyColor();
  expect(dayGreen).toBeGreaterThan(Math.max(dayRed, dayBlue));
  await page.waitForTimeout(160);
  expect(await pixels() === morning).toBe(true);
  const sunset = page.getByRole("button", { name: "노을", exact: true });
  await sunset.focus();
  await page.keyboard.press("Space");
  await expect(sunset).toHaveAttribute("aria-pressed", "true");
  const evening = await pixels();
  const [eveningRed, eveningGreen, eveningBlue] = await skyColor();
  expect(eveningRed).toBeGreaterThan(Math.max(eveningGreen, eveningBlue));
  expect(evening === morning).toBe(false);
  await page.getByRole("button", { name: "별밤", exact: true }).click();
  expect(await pixels() === evening).toBe(false);
  const [nightRed, nightGreen, nightBlue] = await skyColor();
  expect(nightBlue).toBeGreaterThan(Math.max(nightRed, nightGreen));
  await page.getByRole("button", { name: "아침 정원", exact: true }).click();
  expect(await pixels() === morning).toBe(true);

  await canvas.evaluate((element: HTMLCanvasElement) => element.getContext("webgl2")!.getExtension("WEBGL_lose_context")!.loseContext());
  await expect(canvas).toHaveAttribute("data-ready", "false");
  await expect(page.locator(".wi-hero-art .couple-original")).toBeVisible();
  await page.getByRole("button", { name: "별밤", exact: true }).click();
  await expect(page.locator(".wi-hero-art")).toHaveAccessibleName(/별밤/);
});

test("without WebGL the printed garden still changes and the page scrolls", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === "webgl2" ? null : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "노을", exact: true }).click();
  await expect(page.locator(".wi-garden-canvas")).toHaveAttribute("data-ready", "false");
  await expect(page.locator(".wi-garden-print")).toHaveCSS("background-image", /bg-sunset.webp/);
  await page.locator(".wi-scroll").click();
  await expect(page).toHaveURL(/#invitation$/);
});
