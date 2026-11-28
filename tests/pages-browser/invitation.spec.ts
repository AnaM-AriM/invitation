import { test, expect, type Page } from "@playwright/test";
const wishes = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, name: `하객${i + 1}`, message: `축하 메시지 ${i + 1}`, createdAt: "2027-01-01T00:00:00.000Z" }));
async function mock(page: Page, options: { failReads?: () => boolean; post?: (payload: URLSearchParams) => unknown } = {}) {
  await page.route("https://script.google.com/macros/s/fixture/exec**", async route => {
    const request = route.request();
    if (request.method() === "POST") { const payload = new URLSearchParams(request.postData() || ""); await route.fulfill({ json: options.post?.(payload) || { requestId: payload.get("requestId"), comment: { ...wishes[0], name: payload.get("name"), message: payload.get("message") }, total: 76 } }); return; }
    if (options.failReads?.()) { await route.fulfill({ status: 503, body: "unavailable" }); return; }
    const url = new URL(request.url()), p = Number(url.searchParams.get("page") || 0), s = Number(url.searchParams.get("scene") || 0);
    await route.fulfill({ json: { total: wishes.length, comments: [...wishes].reverse().slice(p * 6, p * 6 + 6), guests: wishes.slice(s * 36, s * 36 + 36), page: p, scene: s } });
  });
}
test("mobile nested deployment preserves assets, pagination, selection, ordinal and dog controls", async ({ page }) => {
  const failures: string[] = [], errors: string[] = [];
  page.on("response", response => { if (response.status() >= 400 && response.url().includes("/assets/")) failures.push(response.url()); });
  page.on("pageerror", error => errors.push(error.message));
  await mock(page); await page.goto("./");
  await page.getByTestId("garden-scene").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "정원 전체 보기", exact: true }).click();
  await expect(page.getByTestId("guest-total")).toHaveText("75"); await expect(page.getByTestId("guest")).toHaveCount(36);
  await expect(page.locator(".wi-comments article").first()).toContainText("하객75"); await expect(page.locator(".wi-comments article")).toHaveCount(6);
  await page.getByRole("button", { name: "다음 정원", exact: true }).click();
  await expect(page.getByTestId("guest").first()).toHaveAttribute("data-ordinal", "36"); await expect(page.getByTestId("guest").first()).toHaveAttribute("aria-label", "하객37 님의 축하 읽기");
  await page.getByTestId("guest").first().focus(); await page.keyboard.press("Enter"); await expect(page.locator(".guest-popover")).toContainText("축하 메시지 37");
  await page.getByRole("button", { name: "축하 메시지 닫기", exact: true }).click();
  await page.getByRole("button", { name: "다음 메시지", exact: true }).click(); await expect(page.locator(".wi-comments article").first()).toContainText("하객69");
  await expect(page.getByTestId("party-dog")).toBeAttached(); await expect(page.getByRole("button", { name: "강아지와 다음 축하 보기" })).toBeEnabled();
  await expect(page.locator(".couple-rig[data-preview=false]")).toHaveAttribute("data-motion-ready", "true");
  await expect(page.locator(".guest-rig").first()).toHaveAttribute("data-motion-ready", "true");
  await page.evaluate(() => document.fonts.ready); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const sources = await page.locator("img").evaluateAll(images => images.map(image => image.getAttribute("src")).filter(Boolean));
  expect(sources.filter(path => path!.startsWith("/assets/"))).toEqual([]);
  await page.screenshot({ path: "outputs/pages/nested-mobile.png", fullPage: true }); expect(failures).toEqual([]); expect(errors).toEqual([]);
});
test("wrong acknowledgment keeps payload and UUID through retry, confirmed save clears form", async ({ page }) => {
  const attempts: URLSearchParams[] = [];
  await mock(page, { post: payload => { attempts.push(payload); return { requestId: attempts.length === 1 ? "wrong" : payload.get("requestId"), comment: { ...wishes[0], name: payload.get("name"), message: payload.get("message") }, total: 76 }; } });
  await page.goto("./#guestbook"); await page.getByLabel("성함", { exact: true }).fill("새 하객"); await page.getByLabel("축하의 마음", { exact: true }).fill("오래 행복하세요");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click(); await expect(page.getByLabel("성함", { exact: true })).toHaveValue("새 하객"); await expect(page.locator(".wi-toast")).toContainText("입력 내용은 유지");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click(); await expect(page.getByLabel("성함", { exact: true })).toHaveValue(""); expect(attempts).toHaveLength(2); expect(attempts[1].toString()).toBe(attempts[0].toString());
});
test("failed refresh retains comments and never changes to demo", async ({ page }) => {
  let fail = false; await mock(page, { failReads: () => fail }); await page.goto("./"); await expect(page.locator(".wi-comments article")).toHaveCount(6); fail = true;
  await page.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("불러오지 못했어요"); await expect(page.locator(".wi-comments article").first()).toContainText("하객75"); await expect(page.locator(".wi-demo-note")).toHaveCount(0);
});
test("reduced motion keeps illustration and disables automatic dog movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await mock(page); await page.goto("./#guestbook"); await expect(page.getByTestId("party-dog")).toHaveAttribute("data-animate", "false"); await expect(page.getByRole("button", { name: "강아지 안내 일시정지" })).toBeDisabled();
  await page.getByRole("button", { name: "정원 전체 보기", exact: true }).click();
  await expect(page.locator(".reception-couple .couple-original")).toBeVisible();
});
test("lost POST response preserves one request across retries and edited text gets a new UUID", async ({ page }) => {
  const ids: string[] = []; let calls = 0;
  await mock(page);
  await page.route("https://script.google.com/macros/s/fixture/exec**", async route => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const body = new URLSearchParams(route.request().postData() || ""); ids.push(body.get("requestId")!); calls++;
    if (calls < 3) { await route.abort("failed"); return; }
    await route.fulfill({ json: { requestId: body.get("requestId"), comment: { ...wishes[0], name: body.get("name"), message: body.get("message") }, total: 76 } });
  });
  await page.goto("./#guestbook"); await page.getByLabel("성함", { exact: true }).fill("재시도"); await page.getByLabel("축하의 마음", { exact: true }).fill("행복하세요");
  const submit = page.getByRole("button", { name: "축하 메시지 남기기", exact: true });
  await submit.click(); await expect(page.locator(".wi-toast")).toContainText("입력 내용은 유지");
  await submit.click(); await expect(page.locator(".wi-toast")).toContainText("입력 내용은 유지"); expect(ids[1]).toBe(ids[0]);
  await page.getByLabel("축하의 마음", { exact: true }).fill("오래오래 행복하세요"); await submit.click(); await expect(page.getByLabel("성함", { exact: true })).toHaveValue(""); expect(ids[2]).not.toBe(ids[1]);
});
test("timed out refresh retains cached comments and restores controls", async ({ page }) => {
  await mock(page); await page.goto("./#guestbook"); await expect(page.locator(".wi-comments article")).toHaveCount(6);
  await page.clock.install();
  await page.route("https://script.google.com/macros/s/fixture/exec**", async route => { if (route.request().method() === "GET") return; await route.fallback(); });
  await page.getByRole("button", { name: "새로고침", exact: true }).click(); await expect(page.getByRole("button", { name: "불러오는 중…", exact: true })).toBeDisabled();
  await page.clock.fastForward(16000); await expect(page.getByRole("alert")).toContainText("불러오지 못했어요"); await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeEnabled(); await expect(page.locator(".wi-comments article").first()).toContainText("하객75");
});
test("later refresh wins when an old fetch resolves out of order despite abort", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.fetch;
    let gets = 0;
    window.fetch = async (input, init) => {
      if (String(input).includes("script.google.com") && (!init?.method || init.method === "GET")) {
        const order = ++gets;
        const response = await original(input, { ...init, signal: undefined });
        if (order === 2) { const text = await response.text(); await new Promise(resolve => setTimeout(resolve, 1800)); return new Response(text); }
        return response;
      }
      return original(input, init);
    };
  });
  await mock(page);
  let readCount = 0;
  await page.route("https://script.google.com/macros/s/fixture/exec**", async route => {
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    readCount++;
    if (readCount !== 2) { await route.fallback(); return; }
    await route.fulfill({ json: { total: 74, comments: [...wishes].reverse().slice(1, 7), guests: wishes.slice(0, 36), page: 0, scene: 0 } });
  });
  await page.goto("./#guestbook"); await expect(page.locator(".wi-comments article")).toHaveCount(6);
  // A pending form submit can finish while a user refresh is still in flight.
  await page.getByRole("button", { name: "새로고침", exact: true }).click();
  await page.getByLabel("성함", { exact: true }).fill("새 축하"); await page.getByLabel("축하의 마음", { exact: true }).fill("행복하세요");
  await page.getByRole("button", { name: "축하 메시지 남기기", exact: true }).click();
  await expect(page.getByLabel("성함", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "새로고침", exact: true })).toBeEnabled();
  await page.waitForTimeout(2100);
  await expect(page.getByTestId("guest-total")).toHaveText("75"); await expect(page.locator(".wi-comments article").first()).toContainText("하객75");
});
