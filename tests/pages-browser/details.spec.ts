import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const venue = "전주 그랜드힐스턴";
const address = "전북특별자치도 전주시 완산구 서곡5길 22-5";
test.beforeEach(async ({ page }) => {
  await page.route("https://script.google.com/macros/s/fixture/exec**", route => route.fulfill({ json: { total: 0, comments: [], guests: [], page: 0, scene: 0 } }));
});
test("real wedding details, Saturday calendar and pending personal contacts agree", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toHaveText("권아남&유아림");
  await expect(page.locator(".wi-date-line")).toHaveText("2027.03.13");
  await expect(page.locator(".wi-venue-line")).toContainText("2027년 3월 13일 토요일 오후 2:00");
  await expect(page.locator(".wi-venue-line")).toContainText(venue);
  await expect(page.locator(".wi-venue-line")).not.toContainText(" · ");
  await expect(page.locator(".wi-example")).toHaveCount(0);
  await expect(page.locator(".wi-families")).not.toContainText(/○|아들|딸/);
  await expect(page.locator("#location")).not.toContainText("홀 이름");
  const day = page.getByLabel("예식일 13일", { exact: true });
  await expect(day).toHaveText("13");
  expect(await day.evaluate(element => Array.from(element.parentElement!.children).indexOf(element) % 7)).toBe(6);
  await expect(page.getByRole("button", { name: "신랑 전화 · 번호 준비 중", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "신부 전화 · 번호 준비 중", exact: true })).toBeDisabled();
  await expect(page.locator('.wi-families a[href^="tel:"], .wi-families a[href^="sms:"]')).toHaveCount(0);
});
test("venue links target the verified place and address copy copies the full address", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { document.documentElement.dataset.copiedAddress = value; } } });
  });
  await page.goto("./#location");
  await expect(page.getByRole("link", { name: "카카오맵", exact: true })).toHaveAttribute("href", "https://map.kakao.com/link/map/1924220244");
  await expect(page.getByRole("link", { name: "길찾기 · 내비", exact: true })).toHaveAttribute("href", "https://map.kakao.com/link/to/1924220244");
  await expect(page.getByRole("link", { name: "네이버 지도", exact: true })).toHaveAttribute("href", `https://map.naver.com/p/search/${encodeURIComponent(`${venue} ${address}`)}`);
  await expect(page.getByRole("link", { name: `${venue} 예식장에 전화`, exact: true })).toHaveAttribute("href", "tel:063-251-8000");
  await page.getByRole("button", { name: "주소 복사", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-copied-address", address);
});
test("downloaded calendar contains actual couple, venue and KST start converted to UTC", async ({ page }) => {
  await page.goto("./");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "달력에 일정 담기", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("wedding.ics");
  const text = await readFile((await download.path())!, "utf8");
  expect(text).toContain("DTSTART:20270313T050000Z");
  expect(text).toContain("DTEND:20270313T060000Z");
  expect(text).toContain("SUMMARY:권아남 · 유아림 결혼식");
  expect(text).toContain(`LOCATION:${venue} ${address}`);
});
test("configured personal numbers enable distinct telephone and SMS links", async ({ page }) => {
  // Test-only synthetic values never enter the public configuration or launch a call.
  await page.route("**/wedding.ts", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwedding.couple[0].phone = "+820000000001"; wedding.couple[1].phone = "+820000000002";` });
  });
  await page.goto("./#invitation");
  for (const [role, name, phone] of [["신랑", "권아남", "+820000000001"], ["신부", "유아림", "+820000000002"]]) {
    await expect(page.getByRole("link", { name: `${role} ${name}에게 전화`, exact: true })).toHaveAttribute("href", `tel:${phone}`);
    await expect(page.getByRole("link", { name: `${role} ${name}에게 문자`, exact: true })).toHaveAttribute("href", `sms:${phone}`);
  }
  await expect(page.getByRole("button", { name: /번호 준비 중/ })).toHaveCount(0);
});
test("metadata uses the actual names and date", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle("권아남 · 유아림의 결혼식");
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
    await expect(page.locator(selector)).toHaveAttribute("content", "2027-03-13 · 전주 그랜드힐스턴 · 소중한 분들을 초대합니다.");
  }
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "권아남 · 유아림의 결혼식");
});
