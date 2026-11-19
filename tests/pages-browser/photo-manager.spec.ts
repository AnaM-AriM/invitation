import { test, expect, type Page } from '@playwright/test';
import { cp, copyFile, mkdir, mkdtemp, readdir, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
const project = fileURLToPath(new URL('../../', import.meta.url));
const fixtureImage = resolve(project, 'public/assets/v10/decor/arch.webp');
const secret = 'github_pat_fixture_secret';
const head = '1'.repeat(40), base = '2'.repeat(40), oldBlob = '3'.repeat(40), imageBlob = '4'.repeat(40), treeSha = '5'.repeat(40), commitSha = '6'.repeat(40);
type Call = { url: string; method: string; body: Record<string, unknown> | null };
async function mockGitHub(page: Page, options: { reject?: number; hold?: Promise<void>; lost?: boolean } = {}) {
  const calls: Call[] = [];
  const old = [{ src: '/photos/old.webp', alt: '기존 그림', credit: 'retained' }];
  let committed: { src: string; alt: string }[] | undefined;
  const original = await readFile(fixtureImage);
  await page.route('https://api.github.com/**', async route => {
    const request = route.request(), url = request.url(), method = request.method(), body = request.postDataJSON() as Record<string, unknown> | null;
    calls.push({ url, method, body }); expect(request.headers().authorization).toBe(`Bearer ${secret}`); expect(url).not.toContain(secret); expect(JSON.stringify(body)).not.toContain(secret);
    if (options.reject) { await route.fulfill({ status: options.reject, json: { message: `${secret} should never render` } }); return; }
    let result: unknown;
    if (url.endsWith('/git/ref/heads/main')) { if (options.hold) await options.hold; result = { ref: 'refs/heads/main', object: { type: 'commit', sha: head } }; }
    else if (url.endsWith(`/git/commits/${head}`)) result = { sha: head, tree: { sha: base } };
    else if (url.endsWith('?recursive=1')) result = { sha: base, truncated: false, tree: [{ path: 'site/photos.json', mode: '100644', type: 'blob', sha: oldBlob }, { path: 'public/photos/old.webp', mode: '100644', type: 'blob', sha: oldBlob }] };
    else if (url.endsWith(`/git/blobs/${oldBlob}`)) result = { sha: oldBlob, encoding: 'base64', content: Buffer.from(JSON.stringify(old)).toString('base64') };
    else if (url.endsWith('/git/blobs')) { expect(Buffer.from(String(body!.content), 'base64')).toEqual(original); result = { sha: imageBlob }; }
    else if (url.endsWith('/git/trees')) {
      expect(body!.base_tree).toBe(base); const entries = body!.tree as { path: string; mode: string; type: string; sha?: string; content?: string }[];
      expect(entries[0]).toMatchObject({ mode: '100644', type: 'blob', sha: imageBlob }); expect(entries[0].path).toMatch(/^public\/photos\/[a-f0-9-]{36}\.webp$/);
      committed = JSON.parse(entries[1].content!); expect(committed![0]).toEqual(old[0]); expect(committed![1]).toEqual({ src: entries[0].path.slice(6), alt: '우리가 함께한 QA 그림' }); result = { sha: treeSha };
    } else if (url.endsWith('/git/commits')) { expect(body!.parents).toEqual([head]); expect(body!.tree).toBe(treeSha); result = { sha: commitSha, tree: { sha: treeSha }, parents: [{ sha: head }] }; }
    else if (method === 'PATCH') { expect(body).toEqual({ sha: commitSha, force: false }); if (options.lost) { await route.abort('failed'); return; } result = { ref: 'refs/heads/main', object: { type: 'commit', sha: commitSha } }; }
    else throw Error(`Unexpected ${method} ${url}`);
    await route.fulfill({ status: method === 'POST' ? 201 : 200, json: result });
  });
  return { calls, catalog: () => committed };
}
async function fill(page: Page) {
  await page.getByRole('button', { name: '사진 관리', exact: true }).click();
  await page.getByLabel('청첩장 GitHub 저장소 (owner/repository)').fill('owner/invitation');
  await page.getByLabel('GitHub 토큰', { exact: true }).fill(secret);
  await page.getByLabel('사진 선택', { exact: true }).setInputFiles(fixtureImage);
  await expect(page.getByAltText('선택한 사진 미리보기')).toBeVisible();
  await page.getByRole('textbox', { name: '사진 1 설명', exact: true }).fill('우리가 함께한 QA 그림');
}
async function noSecrets(page: Page) {
  expect(await page.evaluate(() => [JSON.stringify(localStorage), JSON.stringify(sessionStorage), location.href, document.body.innerText].join(' '))).not.toContain(secret);
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain(secret);
}
test('owner selection atomically saves with busy guard, clears secrets and selection, and distinguishes pending deployment', async ({ page }) => {
  let release!: () => void; const hold = new Promise<void>(resolve => { release = resolve; });
  const api = await mockGitHub(page, { hold }); const leaks: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('https://api.github.com/') && JSON.stringify([request.url(), request.headers(), request.postData()]).includes(secret)) leaks.push(request.url()); });
  await page.goto('./'); await fill(page);
  await page.getByRole('button', { name: 'GitHub에 저장', exact: true }).dblclick();
  await expect(page.getByRole('button', { name: '사진 관리 닫기' })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog', { name: '사진 관리', exact: true })).toBeVisible();
  release(); await expect(page.getByRole('status').filter({ hasText: 'GitHub 저장소에 저장했어요' })).toContainText('Pages 배포가 끝나면');
  expect(api.calls).toHaveLength(8); expect(api.calls.filter(c => c.method === 'PATCH')).toHaveLength(1);
  await expect(page.getByLabel('GitHub 토큰', { exact: true })).toHaveValue(''); await expect(page.getByAltText('선택한 사진 미리보기')).toHaveCount(0); await expect(page.getByRole('button', { name: 'GitHub에 저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('link', { name: 'GitHub Actions에서 배포 확인' })).toHaveAttribute('href', 'https://github.com/owner/invitation/actions'); await noSecrets(page); expect(leaks).toEqual([]);
  await page.getByRole('button', { name: '사진 관리 닫기' }).click(); await expect(page.getByRole('button', { name: '사진 관리', exact: true })).toBeFocused();
});
test('auth failure retains files, clears token, escapes unsafe details and close restores focus at mobile widths', async ({ page }) => {
  const api = await mockGitHub(page, { reject: 401 }); await page.goto('./'); await fill(page);
  await page.getByRole('button', { name: 'GitHub에 저장', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: '토큰이 유효하지' })).toBeVisible();
  await expect(page.getByLabel('GitHub 토큰', { exact: true })).toHaveValue(''); await expect(page.getByAltText('선택한 사진 미리보기')).toBeVisible(); expect(api.calls).toHaveLength(1); await noSecrets(page);
  for (const width of [320,390]) { await page.setViewportSize({ width, height: 844 }); const box = await page.getByRole('dialog', { name: '사진 관리', exact: true }).boundingBox(); expect(box!.x).toBeGreaterThan(0); expect(box!.width).toBeLessThan(width); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByLabel('GitHub 토큰', { exact: true }).fill(secret); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: '사진 관리', exact: true })).toBeFocused(); await page.getByRole('button', { name: '사진 관리', exact: true }).click(); await expect(page.getByLabel('GitHub 토큰', { exact: true })).toHaveValue(''); await expect(page.getByAltText('선택한 사진 미리보기')).toHaveCount(0);
});
test('invalid image batch performs no GitHub writes and lost acknowledgement never claims success', async ({ page }) => {
  const api = await mockGitHub(page, { lost: true }); await page.goto('./'); await fill(page);
  await page.getByLabel('사진 선택', { exact: true }).setInputFiles([{ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from([137,80,78,71,13,10,26,10]) }]);
  await page.getByRole('button', { name: 'GitHub에 저장', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: '열 수 없는 사진' })).toBeVisible(); expect(api.calls).toHaveLength(0);
  await page.getByLabel('GitHub 토큰', { exact: true }).fill(secret); await page.getByLabel('사진 선택', { exact: true }).setInputFiles(fixtureImage); await page.getByRole('textbox', { name: '사진 1 설명', exact: true }).fill('우리가 함께한 QA 그림'); await page.getByRole('button', { name: 'GitHub에 저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장 여부를 확인하지 못했어요' })).toContainText('재시도 전에'); await expect(page.getByRole('link', { name: 'GitHub Actions에서 배포 확인' })).toHaveCount(0); await expect(page.getByLabel('GitHub 토큰', { exact: true })).toHaveValue(''); expect(api.calls.filter(c => c.method === 'PATCH')).toHaveLength(1);
});
test('mock deployment rebuilds the committed catalog and new browser load shows persisted gallery', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const scratch = await mkdtemp(resolve(tmpdir(), 'invitation-owner-deploy-')); let server: ChildProcess | undefined;
  try {
    for (const name of ['site','app','lib']) await cp(resolve(project,name), resolve(scratch,name), { recursive: true });
    await symlink(resolve(project,'node_modules'), resolve(scratch,'node_modules'));
    for (const name of ['vite.pages.config.ts','package.json','postcss.config.mjs']) await copyFile(resolve(project,name), resolve(scratch,name));
  await mkdir(resolve(scratch, 'scripts'), { recursive: true });
  await copyFile(resolve(project, 'scripts/pages-build.ts'), resolve(scratch, 'scripts/pages-build.ts'));
    await mkdir(resolve(scratch,'public/photos'), { recursive: true });
    for (const name of await readdir(resolve(project,'public'))) if (name !== 'photos') await symlink(resolve(project,'public',name), resolve(scratch,'public',name));
    await copyFile(fixtureImage, resolve(scratch,'public/photos/old.webp')); await writeFile(resolve(scratch,'site/photos.json'), JSON.stringify([{ src: '/photos/old.webp', alt: '기존 그림' }]));
    const vite = resolve(project,'node_modules/vite/bin/vite.js');
    const build = () => execFileSync(process.execPath,[vite,'build','--config',resolve(scratch,'vite.pages.config.ts')], { cwd:scratch, env:{ ...process.env, PAGES_BASE_PATH:'/invitation/', VITE_GUESTBOOK_URL:'' }, stdio:'pipe' });
    build(); server = spawn(process.execPath,[vite,'preview','--config',resolve(scratch,'vite.pages.config.ts'),'--port','4191','--strictPort'], { cwd:scratch, env:{ ...process.env,PAGES_BASE_PATH:'/invitation/' }, stdio:'pipe' });
    await new Promise<void>((accept,reject) => { server!.stdout!.on('data', chunk => { if (String(chunk).includes('4191')) accept(); }); server!.once('error',reject); server!.once('exit', code => reject(Error(`Preview ${code}`))); });
    const chunks: string[] = [], errors: string[] = []; let block = true;
    page.on('request', request => { if (/photo-manager-dialog-[^/]+\.js/.test(request.url())) chunks.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/photo-manager-dialog-*.js', async route => { if (block) await route.abort('failed'); else await route.continue(); });
    const api = await mockGitHub(page); await page.goto('http://127.0.0.1:4191/invitation/'); await expect(page.locator('.wi-gallery button')).toHaveCount(1);
    expect(chunks).toEqual([]);
    await page.getByRole('button', { name: '사진 관리', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: '사진 관리를 불러오지 못했어요' })).toBeVisible();
    expect(chunks).toHaveLength(1); await expect(page.getByRole('dialog', { name: '사진 관리', exact: true })).toHaveCount(0);
    await page.locator('.wi-gallery button').click(); await expect(page.getByRole('dialog', { name: '사진 크게 보기' })).toBeVisible(); await page.keyboard.press('Escape');
    block = false;
    await fill(page); expect(chunks).toHaveLength(2); expect(errors).toEqual([]);
    await page.getByRole('button',{name:'GitHub에 저장',exact:true}).click(); await expect(page.getByRole('status').filter({hasText:'GitHub 저장소에 저장했어요'})).toBeVisible();
    await page.getByRole('button', { name: '사진 관리 닫기' }).click(); await expect(page.getByRole('button', { name: '사진 관리', exact: true })).toBeFocused();
    await page.getByRole('button', { name: '사진 관리', exact: true }).click(); await expect(page.getByLabel('GitHub 토큰', { exact: true })).toHaveValue('');
    await page.keyboard.press('Escape'); expect(chunks).toHaveLength(2);
    // Local fixture rebuild explicitly simulates the separate GitHub Actions deployment.
    const catalog = api.catalog()!; await writeFile(resolve(scratch,'site/photos.json'),JSON.stringify(catalog)); await copyFile(fixtureImage,resolve(scratch,`public${catalog[1].src}`)); build();
    await page.reload(); await expect(page.locator('.wi-gallery button')).toHaveCount(2); await expect(page.getByRole('button',{name:'사진 2 크게 보기: 우리가 함께한 QA 그림'})).toBeVisible(); await page.locator('.wi-gallery img').nth(1).scrollIntoViewIfNeeded(); await expect.poll(() => page.locator('.wi-gallery img').nth(1).evaluate((img:HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('mock-deployed-gallery.png'),fullPage:true}); await noSecrets(page);
  } finally { if (server) { server.kill(); await new Promise(accept => server!.once('exit',accept)); } await rm(scratch,{recursive:true,force:true}); }
});
