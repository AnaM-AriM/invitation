import { test, expect } from '@playwright/test';
import { cp, copyFile, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
const project = fileURLToPath(new URL('../../', import.meta.url));
let scratch: string;
let server: ChildProcess;
// A separate copy supplies obviously illustrative QA fixtures; production config stays empty.
test.beforeAll(async () => {
  test.setTimeout(120000);
  scratch = await mkdtemp(resolve(tmpdir(), 'invitation-photo-browser-'));
  for (const name of ['site', 'app', 'lib']) await cp(resolve(project, name), resolve(scratch, name), { recursive: true });
  for (const name of ['node_modules']) await symlink(resolve(project, name), resolve(scratch, name));
  for (const name of ['vite.pages.config.ts', 'package.json', 'postcss.config.mjs']) await copyFile(resolve(project, name), resolve(scratch, name));
  await mkdir(resolve(scratch, 'scripts'), { recursive: true });
  await copyFile(resolve(project, 'scripts/pages-build.ts'), resolve(scratch, 'scripts/pages-build.ts'));
  await mkdir(resolve(scratch, 'public/photos'), { recursive: true });
  for (const name of await readdir(resolve(project, 'public'))) if (name !== 'photos') await symlink(resolve(project, 'public', name), resolve(scratch, 'public', name));
  await copyFile(resolve(project, 'public/assets/v10/decor/arch.webp'), resolve(scratch, 'public/photos/qa-arch.webp'));
  await writeFile(resolve(scratch, 'site/photos.json'), JSON.stringify([{ src: '/photos/qa-arch.webp', alt: 'QA 꽃 아치 그림 · 실제 커플 사진 아님' }, { src: '/photos/missing.webp', alt: 'QA 불러오기 실패' }, { src: 'https://photos.example.test/qa.webp', alt: 'QA 외부 그림' }]));
  const vite = resolve(project, 'node_modules/vite/bin/vite.js');
  for (const [base, directory] of [['/', 'root'], ['/invitation/', 'nested']]) execFileSync(process.execPath, [vite, 'build', '--config', resolve(scratch, 'vite.pages.config.ts'), '--outDir', resolve(scratch, directory)], { cwd: scratch, env: { ...process.env, PAGES_BASE_PATH: base, VITE_GUESTBOOK_URL: 'https://script.google.com/macros/s/fixture/exec' }, stdio: 'pipe' });
  server = spawn(process.execPath, [vite, 'preview', '--config', resolve(scratch, 'vite.pages.config.ts'), '--outDir', resolve(scratch, 'nested'), '--port', '4191', '--strictPort'], { cwd: scratch, env: { ...process.env, PAGES_BASE_PATH: '/invitation/' }, stdio: 'pipe' });
  await new Promise<void>((accept, reject) => { server.stdout!.on('data', chunk => { if (String(chunk).includes('4191')) accept(); }); server.once('error', reject); server.once('exit', code => reject(new Error(`Preview exited: ${code}`))); });
});
test.afterAll(async () => { server?.kill(); if (scratch) await rm(scratch, { recursive: true, force: true }); });
test('populated nested production gallery supports focus, keyboard, errors and mobile layout', async ({ page }) => {
  await page.route('https://photos.example.test/qa.webp', route => route.fulfill({ path: resolve(project, 'public/assets/v10/decor/arch.webp'), contentType: 'image/webp' }));
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4191/invitation/');
  await expect(page.locator('.wi-cover-photo img')).toHaveAttribute('src', '/invitation/photos/qa-arch.webp');
  await expect(page.locator('.wi-cover-photo img')).toBeVisible();
  expect(await page.locator('.wi-cover-photo img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const thumbs = page.locator('.wi-gallery button'); await expect(thumbs).toHaveCount(3);
  await thumbs.nth(0).click(); const dialog = page.getByRole('dialog', { name: '사진 크게 보기' }); await expect(dialog).toBeVisible(); await expect(dialog.locator('img')).toHaveAttribute('src', '/invitation/photos/qa-arch.webp');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.keyboard.press('ArrowLeft'); await expect(dialog.locator('figcaption')).toHaveText('QA 외부 그림'); await expect(dialog.locator('img')).toHaveAttribute('src', 'https://photos.example.test/qa.webp');
  await page.keyboard.press('ArrowRight'); await expect(dialog.locator('.wi-photo-navigation span')).toHaveText('1 / 3');
  await page.getByRole('button', { name: '다음 사진', exact: true }).click(); await expect(dialog.locator('.wi-photo-error')).toContainText('사진을 불러오지 못했어요');
  await page.keyboard.press('ArrowRight'); await expect(dialog.locator('figcaption')).toHaveText('QA 외부 그림');
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(thumbs.nth(0)).toBeFocused(); expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  await thumbs.nth(2).click(); await page.getByRole('button', { name: '사진 닫기' }).click(); await expect(thumbs.nth(2)).toBeFocused();
  await thumbs.nth(0).click(); await page.mouse.click(2, 2); await expect(dialog).not.toBeVisible();
  for (const width of [320, 390]) { await page.setViewportSize({ width, height: 844 }); await thumbs.nth(0).click(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(width); await page.keyboard.press('Escape'); }
  await page.screenshot({ path: 'outputs/images/qa-photo-fixture-mobile.png', fullPage: true }); await thumbs.nth(0).click(); await page.screenshot({ path: 'outputs/images/qa-photo-modal-mobile.png' }); await page.keyboard.press('Escape'); expect(errors).toEqual([]);
});
test('nested production art loads all 48 guest actors and preserves dog controls without missing assets', async ({ page }) => {
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/')) failures.push(response.url()); });
  const wishes = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, name: `QA 하객${index + 1}`, message: '축하합니다', createdAt: '2027-01-01T00:00:00.000Z' }));
  await page.route('https://script.google.com/macros/s/fixture/exec**', async route => {
    const url = new URL(route.request().url()), scene = Number(url.searchParams.get('scene') || 0);
    await route.fulfill({ json: { total: wishes.length, comments: wishes.slice(0, 6), guests: wishes.slice(scene * 36, scene * 36 + 36), page: 0, scene } });
  });
  await page.goto('http://127.0.0.1:4191/invitation/#guestbook');
  await expect(page.getByTestId('guest')).toHaveCount(36);
  await expect.poll(() => page.locator('.guest-rig[data-preview=false][data-motion-ready=true]').count()).toBe(36);
  await expect(page.locator('.couple-rig[data-preview=false]')).toHaveAttribute('data-motion-ready', 'true');
  await page.getByRole('button', { name: '다음 정원', exact: true }).click();
  await expect(page.getByTestId('guest').first()).toHaveAttribute('data-ordinal', '36');
  await expect.poll(() => page.locator('.guest-rig[data-preview=false][data-motion-ready=true]').count()).toBe(36);
  await expect(page.getByTestId('party-dog')).toBeAttached();
  await expect(page.getByRole('button', { name: '강아지와 다음 축하 보기' })).toBeEnabled();
  expect(failures).toEqual([]); expect(errors).toEqual([]);
});
test('root production build has working photos, single-photo controls and broken-cover illustration fallback', async ({ page }) => {
  server.kill(); await new Promise(resolve => server.once('exit', resolve));
  const vite = resolve(project, 'node_modules/vite/bin/vite.js');
  server = spawn(process.execPath, [vite, 'preview', '--config', resolve(scratch, 'vite.pages.config.ts'), '--outDir', resolve(scratch, 'root'), '--port', '4191', '--strictPort'], { cwd: scratch, env: { ...process.env, PAGES_BASE_PATH: '/' }, stdio: 'pipe' });
  await new Promise<void>(accept => server.stdout!.on('data', chunk => { if (String(chunk).includes('4191')) accept(); }));
  await page.goto('http://127.0.0.1:4191/'); await expect(page.locator('.wi-cover-photo img')).toHaveAttribute('src', '/photos/qa-arch.webp'); expect(await page.locator('.wi-cover-photo img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('.wi-gallery button').first().click(); await expect(page.getByRole('dialog').locator('img')).toHaveAttribute('src', '/photos/qa-arch.webp'); await page.keyboard.press('Escape');
  server.kill(); await new Promise(resolve => server.once('exit', resolve));
  // This test modifies only the scratch build input, never the real catalog.
  await writeFile(resolve(scratch, 'site/photos.json'), JSON.stringify([{ src: '/photos/missing.webp', alt: 'QA 실패 표지' }]));
  execFileSync(process.execPath, [vite, 'build', '--config', resolve(scratch, 'vite.pages.config.ts'), '--outDir', resolve(scratch, 'root')], { cwd: scratch, env: { ...process.env, PAGES_BASE_PATH: '/', VITE_GUESTBOOK_URL: '' }, stdio: 'pipe' });
  server = spawn(process.execPath, [vite, 'preview', '--config', resolve(scratch, 'vite.pages.config.ts'), '--outDir', resolve(scratch, 'root'), '--port', '4191', '--strictPort'], { cwd: scratch, env: { ...process.env, PAGES_BASE_PATH: '/' }, stdio: 'pipe' });
  await new Promise<void>(accept => server.stdout!.on('data', chunk => { if (String(chunk).includes('4191')) accept(); }));
  await page.goto('http://127.0.0.1:4191/'); await expect(page.locator('.wi-hero-art')).toBeVisible(); await expect(page.locator('.wi-hero-art .couple-rig')).toBeVisible();
  await page.locator('.wi-gallery button').click(); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible(); await expect(dialog.locator('.wi-photo-error')).toBeVisible(); await expect(page.getByRole('button', { name: '이전 사진' })).toHaveCount(0); await expect(page.getByRole('button', { name: '다음 사진', exact: true })).toHaveCount(0); await expect(dialog.locator('.wi-photo-navigation span')).toHaveText('1 / 1'); await page.keyboard.press('Escape'); await expect(page.locator('.wi-gallery button')).toBeFocused();
});
