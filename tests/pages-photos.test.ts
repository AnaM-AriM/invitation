import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, copyFile, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../scripts/import-photos.mjs', import.meta.url));
const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
async function fixture(run: (root: string, invoke: (...files: string[]) => ReturnType<typeof spawnSync>) => Promise<void>) {
  const root = await mkdtemp(resolve(tmpdir(), 'invitation-photos-'));
  try {
    await mkdir(resolve(root, 'scripts')); await mkdir(resolve(root, 'site')); await mkdir(resolve(root, 'public/photos'), { recursive: true });
    await copyFile(script, resolve(root, 'scripts/import-photos.mjs')); await writeFile(resolve(root, 'site/photos.json'), '[]\n');
    await run(root, (...files) => spawnSync(process.execPath, [resolve(root, 'scripts/import-photos.mjs'), ...files], { cwd: tmpdir(), encoding: 'utf8' }));
  } finally { await rm(root, { recursive: true, force: true }); }
}
async function catalog(root: string) { return JSON.parse(await readFile(resolve(root, 'site/photos.json'), 'utf8')) as { src: string; alt: string }[]; }
async function unchanged(root: string, before: string, files: string[]) { assert.equal(await readFile(resolve(root, 'site/photos.json'), 'utf8'), before); assert.deepEqual(await readdir(resolve(root, 'public/photos')), files); }
test('photo import anchors project to script, preserves bytes and appends every format in order', async () => fixture(async (root, invoke) => {
  const formats = [['A.JPG', Buffer.from([255,216,255,1])], ['B.png', png], ['C.webp', Buffer.from('RIFF0000WEBPcontent')]] as const;
  for (const [name, bytes] of formats) await writeFile(resolve(root, name), bytes);
  assert.equal(invoke(...formats.map(([name]) => resolve(root, name))).status, 0);
  const entries = await catalog(root); assert.equal(entries.length, 3);
  for (const [i, [name, bytes]] of formats.entries()) { assert.equal(entries[i].src, `/photos/${name.replace('.JPG', '.jpg')}`); assert.equal(typeof entries[i].alt, 'string'); assert.deepEqual(await readFile(resolve(root, `public${entries[i].src}`)), bytes); }
}));
test('repeated input and filename collisions append unique files without overwriting old bytes or entries', async () => fixture(async (root, invoke) => {
  const old = [{ src: '/photos/old.png', alt: '기존 설명' }]; await writeFile(resolve(root, 'site/photos.json'), JSON.stringify(old));
  await writeFile(resolve(root, 'public/photos/A.png'), 'old collision'); await writeFile(resolve(root, 'public/photos/old.png'), 'old photo'); await writeFile(resolve(root, 'A.png'), png);
  assert.equal(invoke(resolve(root, 'A.png'), resolve(root, 'A.png')).status, 0); assert.equal(invoke(resolve(root, 'A.png')).status, 0);
  const entries = await catalog(root); assert.equal(entries.length, 4); assert.deepEqual(entries[0], old[0]); assert.deepEqual(entries.slice(1).map(p => p.src), ['/photos/A-1.png', '/photos/A-2.png', '/photos/A-3.png']);
  assert.equal(await readFile(resolve(root, 'public/photos/A.png'), 'utf8'), 'old collision'); assert.equal(await readFile(resolve(root, 'public/photos/old.png'), 'utf8'), 'old photo');
}));
test('whole batch preflight rejects wrong header, empty, oversize, missing and directory without state changes', async () => fixture(async (root, invoke) => {
  await writeFile(resolve(root, 'ok.png'), png); await writeFile(resolve(root, 'wrong.jpg'), png); await writeFile(resolve(root, 'empty.png'), ''); await writeFile(resolve(root, 'big.png'), Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024)])); await mkdir(resolve(root, 'folder.png'));
  for (const bad of ['wrong.jpg', 'empty.png', 'big.png', 'missing.png', 'folder.png']) { assert.notEqual(invoke(resolve(root, 'ok.png'), resolve(root, bad)).status, 0); await unchanged(root, '[]\n', []); }
}));
test('10 MiB inclusive accepted and safe portable names generated', async () => fixture(async (root, invoke) => {
  const bytes = Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)]); await writeFile(resolve(root, '사진 !.PNG'), bytes);
  assert.equal(invoke(resolve(root, '사진 !.PNG')).status, 0); const entries = await catalog(root); assert.equal(entries.length, 1); assert.equal(entries[0].src, '/photos/photo.png'); assert.deepEqual(await readFile(resolve(root, `public${entries[0].src}`)), bytes);
}));
test('invalid existing catalog is rejected before any file write', async () => fixture(async (root, invoke) => {
  await writeFile(resolve(root, 'ok.png'), png);
  for (const invalid of ['{', '{}', '[{"src":"x"}]', '[{"src":" ","alt":"x"}]', '[null]']) { await writeFile(resolve(root, 'site/photos.json'), invalid); assert.notEqual(invoke(resolve(root, 'ok.png')).status, 0); await unchanged(root, invalid, []); }
}));
test('no inputs gives usage and unsupported extension is rejected', async () => fixture(async (root, invoke) => {
  assert.notEqual(invoke().status, 0); assert.match(String(invoke().stderr), /사용법/); await writeFile(resolve(root, 'photo.gif'), png); assert.notEqual(invoke(resolve(root, 'photo.gif')).status, 0); await unchanged(root, '[]\n', []);
}));

test('catalog write failure rolls back only new copies and preserves existing bytes', async () => fixture(async (root, invoke) => {
  await writeFile(resolve(root, 'ok.png'), png); await writeFile(resolve(root, 'public/photos/old.png'), 'original');
  const before = '[{"src":"/photos/old.png","alt":"기존"}]'; await writeFile(resolve(root, 'site/photos.json'), before);
  await chmod(resolve(root, 'site'), 0o555);
  try { assert.notEqual(invoke(resolve(root, 'ok.png')).status, 0); await unchanged(root, before, ['old.png']); assert.equal(await readFile(resolve(root, 'public/photos/old.png'), 'utf8'), 'original'); }
  finally { await chmod(resolve(root, 'site'), 0o755); }
}));
