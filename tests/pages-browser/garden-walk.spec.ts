import { expect, test, type Locator, type Page } from "@playwright/test";

const canvasSelector = ".scene .garden-walk-canvas[data-ready=true]";
const date = "2027-01-01T00:00:00.000Z";

async function guestbook(page: Page, count = 0) {
  // Server IDs need not match a visitor's ordinal in the garden.
  const wishes = Array.from({ length: count }, (_, i) => ({
    id: 1001 + i, name: `하객 ${i + 1}`, message: `${i + 1}번째 축하 인사`, createdAt: date,
  }));
  await page.route("https://script.google.com/macros/s/fixture/exec**", async route => {
    const request = route.request();
    if (request.method() === "POST") {
      const payload = new URLSearchParams(request.postData()!);
      const comment = { id: 1001 + wishes.length, name: payload.get("name")!, message: payload.get("message")!, createdAt: date };
      wishes.push(comment);
      await route.fulfill({ json: { requestId: payload.get("requestId"), comment, total: wishes.length } });
      return;
    }
    const params = new URL(request.url()).searchParams;
    const scene = Number(params.get("scene")), pageIndex = Number(params.get("page"));
    await route.fulfill({ json: {
      total: wishes.length, page: pageIndex, scene,
      guests: wishes.slice(scene * 36, (scene + 1) * 36),
      comments: [...wishes].reverse().slice(pageIndex * 6, (pageIndex + 1) * 6),
    } });
  });
  await page.route("https://www.google.com/maps/embed**", route => route.fulfill({ body: "", contentType: "text/html" }));
}

async function configureWebGL(page: Page, enabled: boolean) {
  await page.addInitScript(available => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, options?: Record<string, unknown>) {
      if (type !== "webgl2") return Reflect.apply(original, this, [type, options]);
      if (!available) return null;
      return Reflect.apply(original, this, [type, { ...options, preserveDrawingBuffer: true }]);
    } as typeof original;
  }, enabled);
}

// Read only GPU output so message bubbles and button highlights cannot impersonate camera movement.
async function landscapePixels(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const sample = document.createElement("canvas");
    sample.width = 48; sample.height = 64;
    sample.getContext("2d")!.drawImage(element, 0, 0, sample.width, sample.height);
    return sample.toDataURL();
  });
}

test("a first wish joins the 3D garden and the dog's visit reaches a selectable guest", async ({ page }) => {
  await guestbook(page);
  await configureWebGL(page, true);
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "축하가 모여 피어나는 정원" })).toBeInViewport();
  const canvas = page.locator(canvasSelector);
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("guest-total")).toHaveText("0");
  const next = page.getByRole("button", { name: "강아지와 다음 축하 보기" });
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "강아지 안내 일시정지" }).click();

  await page.getByLabel("성함", { exact: true }).fill("봄 손님");
  await page.getByLabel("축하의 마음", { exact: true }).fill("두 분의 봄을 축하해요.");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click();
  await expect(page.getByTestId("guest-total")).toHaveText("1");
  await expect(page.locator(".wi-comments article")).toHaveCount(1);
  await expect(page.locator(".wi-comments article")).toContainText("두 분의 봄을 축하해요.");
  await canvas.scrollIntoViewIfNeeded();
  const home = await landscapePixels(canvas);
  await next.click();
  await expect(page.getByTestId("party-dog")).toHaveAttribute("data-phase", "walking");
  await expect.poll(() => landscapePixels(canvas)).not.toBe(home);
  const duringWalk = await landscapePixels(canvas);
  await expect(page.getByTestId("dog-message")).toContainText("두 분의 봄을 축하해요.", { timeout: 13000 });
  await expect.poll(() => landscapePixels(canvas)).not.toBe(duringWalk);
  const view = (await canvas.boundingBox())!;
  const caption = (await page.getByTestId("dog-message").boundingBox())!;
  expect(caption.y).toBeGreaterThanOrEqual(view.y + view.height - 1);

  // At arrival the camera faces the visitor. Select the character through the real canvas.
  await canvas.click();
  await expect(page.locator(".guest-popover strong")).toHaveText("봄 손님");
  await expect(page.locator(".guest-popover p")).toHaveText("두 분의 봄을 축하해요.");
});

test("an enabled dog guide brings the newly submitted visitor into view", async ({ page }) => {
  await guestbook(page, 2);
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  const canvas = page.locator(canvasSelector);
  await expect(canvas).toBeInViewport();
  await expect(page.getByTestId("guest-total")).toHaveText("2");
  await expect(page.getByRole("button", { name: "강아지 안내 일시정지" })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("성함", { exact: true }).fill("세 번째 정원 손님");
  await page.getByLabel("축하의 마음", { exact: true }).fill("세 번째 손님이 보낸 봄꽃 축하");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click();
  await expect(page.getByTestId("guest-total")).toHaveText("3");
  await expect(canvas).toBeInViewport({ ratio: .5 });
  const message = page.getByTestId("dog-message");
  await expect(message).toHaveAttribute("data-ordinal", "2", { timeout: 13000 });
  await expect(message.locator("strong")).toHaveText("세 번째 정원 손님");
  await expect(message.locator("p")).toHaveText("세 번째 손님이 보낸 봄꽃 축하");
});

test("reduced-motion visits stay still and select the guest in the next garden", async ({ page }) => {
  await guestbook(page, 36);
  await configureWebGL(page, true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  await page.getByTestId("garden-scene").scrollIntoViewIfNeeded();
  const canvas = page.locator(canvasSelector);
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("button", { name: "강아지 안내 일시정지" })).toBeDisabled();
  const home = await landscapePixels(canvas);
  await page.waitForTimeout(220);
  expect(await landscapePixels(canvas)).toBe(home);

  await page.getByLabel("성함", { exact: true }).fill("하객 37");
  await page.getByLabel("축하의 마음", { exact: true }).fill("37번째 축하 인사");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "정원 장면" })).toContainText("2 / 2");
  await page.getByRole("button", { name: "강아지와 다음 축하 보기" }).click();
  await expect(page.getByTestId("dog-message")).toContainText("37번째 축하 인사");
  await expect.poll(() => landscapePixels(canvas)).not.toBe(home);
  await page.getByRole("button", { name: "정원 전체 보기", exact: true }).click();
  const guest = page.getByRole("button", { name: "하객 37 님의 축하 읽기" });
  await guest.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".guest-popover p")).toHaveText("37번째 축하 인사");
  await page.getByRole("button", { name: "축하 메시지 닫기", exact: true }).click();
  await page.getByRole("button", { name: "강아지 시점으로 보기", exact: true }).click();
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId("guest-total")).toHaveText("37");
});

test("a guest can still open the original garden and read a wish without WebGL", async ({ page }) => {
  await guestbook(page, 1);
  await configureWebGL(page, false);
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  const guest = page.getByRole("button", { name: "하객 1 님의 축하 읽기" });
  await guest.scrollIntoViewIfNeeded();
  await guest.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".guest-popover p")).toHaveText("1번째 축하 인사");
  await expect(page.locator(canvasSelector)).toHaveCount(0);
});

test("a dancer in the overview steps, pauses and resumes", async ({ page }) => {
  await guestbook(page, 4);
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "정원 전체 보기", exact: true }).click();
  const dancer = page.getByTestId("guest").locator('.guest-dance-canvas[data-ready="true"]').first();
  await expect(dancer).toBeVisible();
  const pose = () => dancer.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  const initial = await pose();
  await expect.poll(pose).not.toBe(initial);
  await page.getByRole("button", { name: "강아지 안내 일시정지" }).click();
  await expect(page.getByRole("button", { name: "강아지 안내 시작" })).toBeVisible();
  const paused = await pose();
  await page.waitForTimeout(300);
  expect(await pose()).toBe(paused);
  await page.getByRole("button", { name: "강아지 안내 시작" }).click();
  await expect.poll(pose).not.toBe(paused);
});

test.describe("high-density mobile garden", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

  test("the close-up draws ink at the phone's pixel density", async ({ page }) => {
    await guestbook(page, 4);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
    const canvas = page.locator(canvasSelector);
    await expect(canvas).toBeVisible();
    const { drawing, screen } = await canvas.evaluate((view: HTMLCanvasElement) => ({
      drawing: [view.width, view.height],
      screen: [view.clientWidth * window.devicePixelRatio, view.clientHeight * window.devicePixelRatio],
    }));
    expect(drawing).toEqual(screen);
  });
});

test("a handbag keeps its original ink when its owner's hand returns to rest", async ({ page }) => {
  await guestbook(page, 36);
  await page.goto("./#guestbook", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "정원 전체 보기", exact: true }).click();
  const guest = page.locator('[data-testid="guest"][data-sprite="28"]');
  const drawing = guest.locator(".guest-motion-canvas[data-ready=true]");
  await expect(drawing).toBeVisible();

  // This handle crosses the arm boundary in the original illustration.
  const changedInk = () => guest.evaluate(element => {
    const reference = document.createElement("canvas");
    reference.width = 120;
    reference.height = 64;
    const ink = reference.getContext("2d")!;
    ink.drawImage(element.querySelector<HTMLImageElement>("img.guest-original")!, 110, 198, 120, 64, 0, 0, 120, 64);
    const still = ink.getImageData(0, 0, 120, 64).data;
    const moving = element.querySelector("canvas")!.getContext("2d")!.getImageData(110, 198, 120, 64).data;
    let changes = 0;
    for (let i = 0; i < still.length; i += 4) {
      if (still[i + 3] > 240 && still[i] < 160 && Math.abs(still[i] - moving[i]) > 18) changes++;
    }
    return changes;
  });
  await expect.poll(changedInk, { timeout: 8000, intervals: [100] }).toBeGreaterThan(0);
  await expect.poll(changedInk, { timeout: 8000, intervals: [100] }).toBe(0);
});
