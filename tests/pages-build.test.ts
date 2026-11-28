import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { templates, SPRITE_COUNT, spritePath, gardenDecorations, receptionFurnishings } from '../lib/garden.ts';
import { copyPagesPublic, excludedVersions, projectGuestMotion, selectedPublicFiles } from '../scripts/pages-build.ts';
const root = resolve(import.meta.dirname, '..');
async function inventory(directory: string, prefix = ''): Promise<string[]> {
  const result: string[] = [];
  for (const name of await readdir(directory)) {
    const path = prefix + name;
    if ((await stat(resolve(directory, name))).isDirectory()) result.push(...await inventory(resolve(directory, name), path + '/'));
    else result.push(path);
  }
  return result.sort();
}
// Historical directories are synthetic: the standalone repository contains only active art.
async function withPublicFixture(run: (source: string) => Promise<void>) {
  const source = await mkdtemp(resolve(tmpdir(), 'pages-public-fixture-'));
  try {
    for (const path of ['custom.txt', 'assets/v10/current.webp', ...excludedVersions.flatMap(version => [`assets/${version}/a.webp`, `assets/${version}/nested/b.png`])]) {
      await mkdir(resolve(source, path, '..'), { recursive: true });
      await writeFile(resolve(source, path), `fixture bytes: ${path}`);
    }
    await run(source);
  } finally { await rm(source, { recursive: true, force: true }); }
}
test('Pages public selection is the exact inventory minus unused legacy versions, with identical copied bytes', async () => withPublicFixture(async source => {
  const original = await inventory(source);
  const expected = original.filter(path => !excludedVersions.some(version => path.startsWith(`assets/${version}/`)));
  assert.deepEqual(await selectedPublicFiles(source, '/', []), expected);
  const excluded = original.filter(path => !expected.includes(path));
  assert.equal((await Promise.all(excluded.map(async path => (await stat(resolve(source, path))).size))).reduce((a, b) => a + b, 0), excluded.reduce((bytes, path) => bytes + Buffer.byteLength(`fixture bytes: ${path}`), 0));
  const output = await mkdtemp(resolve(tmpdir(), 'pages-copy-'));
  try {
    await copyPagesPublic(source, output, '/invitation/', []);
    assert.deepEqual(await inventory(output), expected);
    for (const path of expected) assert.deepEqual(await readFile(resolve(output, path)), await readFile(resolve(source, path)), path);
  } finally { await rm(output, { recursive: true, force: true }); }
}));
test('every configured legacy photo and separate cover keeps its whole directory under real publicPath semantics', async () => withPublicFixture(async source => {
  const all = await inventory(source);
  for (const version of excludedVersions) {
    const sample = all.find(path => path.startsWith(`assets/${version}/`))!;
    for (const base of ['/', '/invitation/']) for (const src of ['/' + sample, sample, './' + sample, '/' + sample.replace('assets', '%61ssets') + '?original=1#cover']) {
      const selected = await selectedPublicFiles(source, base, [{ src }]);
      assert.deepEqual(selected.filter(path => path.startsWith(`assets/${version}/`)), all.filter(path => path.startsWith(`assets/${version}/`)), `${base} ${src}`);
      assert.deepEqual(await selectedPublicFiles(source, base, [], { src }), selected);
    }
  }
}));
test('external references do not retain legacy directories and uncertain local references keep all public files', async () => withPublicFixture(async source => {
  const all = await inventory(source), empty = await selectedPublicFiles(source, '/invitation/', []);
  assert.deepEqual(await selectedPublicFiles(source, '/invitation/', [{ src: 'https://example.test/assets/v2/a.webp' }, { src: '//example.test/a.webp' }, { src: 'data:image/png;base64,AAAA' }]), empty);
  for (const src of ['/missing.webp', '/assets/%ZZ/a.webp', '../assets/v2/a.webp', '/assets/v2/%2funknown.webp', '']) assert.deepEqual(await selectedPublicFiles(source, '/invitation/', [{ src }]), all, src);
}));
test('public copy follows source symlinks into real destination files and preserves unrelated files', async () => {
  const scratch = await mkdtemp(resolve(tmpdir(), 'pages-symlink-'));
  try {
    await mkdir(resolve(scratch, 'public')); await mkdir(resolve(scratch, 'real'));
    await writeFile(resolve(scratch, 'real/custom.txt'), 'unrelated bytes');
    await symlink(resolve(scratch, 'real'), resolve(scratch, 'public/custom'));
    await copyPagesPublic(resolve(scratch, 'public'), resolve(scratch, 'out'), '/', []);
    assert.equal(await readFile(resolve(scratch, 'out/custom/custom.txt'), 'utf8'), 'unrelated bytes');
    await writeFile(resolve(scratch, 'out/custom/custom.txt'), 'new output');
    assert.equal(await readFile(resolve(scratch, 'real/custom.txt'), 'utf8'), 'unrelated bytes');
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
test('Pages guest projection retains all ordered action/facing values and exact own still presence only', async () => {
  const source = JSON.parse(await readFile(resolve(root, 'lib/guest-motion.json'), 'utf8'));
  const projected = projectGuestMotion(source);
  assert.equal(projected.length, SPRITE_COUNT);
  for (const [index, item] of source.entries()) {
    assert.deepEqual(Object.keys(projected[index]), Object.hasOwn(item, 'still') ? ['action', 'facing', 'still'] : ['action', 'facing']);
    assert.equal(projected[index].action, item.action); assert.equal(projected[index].facing, item.facing);
    assert.equal(Object.hasOwn(projected[index], 'still'), Object.hasOwn(item, 'still'));
    if (Object.hasOwn(item, 'still')) assert.deepEqual(projected[index].still, item.still);
  }
  assert.deepEqual(projectGuestMotion([{ action: 'watch', facing: 0, still: null }, { action: 'wave', facing: -1, still: '' }]), [{ action: 'watch', facing: 0, still: null }, { action: 'wave', facing: -1, still: '' }]);
});

test('root and nested production outputs retain every active dynamic art dependency including threshold neighbors', async () => {
  const guests = JSON.parse(await readFile(resolve(root, 'lib/guest-parts.json'), 'utf8'));
  const couple = JSON.parse(await readFile(resolve(root, 'lib/couple-parts.json'), 'utf8'));
  const paths = new Set<string>([...templates.map(item => item.image), '/assets/v10/couple.webp']);
  for (let sprite = 0; sprite < SPRITE_COUNT; sprite++) paths.add(spritePath(sprite));
  assert.equal(guests.length, SPRITE_COUNT);
  for (const rig of [...guests, couple]) {
    paths.add(rig.body); paths.add(rig.source);
    for (const arm of Object.values(rig.arms) as { source?: string }[]) paths.add(arm.source ?? rig.source);
  }
  for (const part of ['tail', 'hind-leg', 'front-leg', 'body', 'head', 'bowtie']) paths.add(`/assets/v11/dog/${part}.webp`);
  for (const threshold of [0, 1, 4, 6, 12, 24, 36, 60, 100]) for (const count of [threshold - 1, threshold, threshold + 1].filter(count => count >= 0)) {
    for (const item of gardenDecorations(count)) paths.add(`/assets/v10/decor/${item.asset}.webp`);
    for (const item of receptionFurnishings(count)) paths.add(`/assets/v10/props/${item.asset}.webp`);
  }
  const scratch = await mkdtemp(resolve(tmpdir(), 'pages-production-art-'));
  try {
    for (const [base, name] of [['/', 'root'], ['/invitation/', 'nested']]) {
      const output = resolve(scratch, name);
      execFileSync(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', resolve(root, 'vite.pages.config.ts'), '--outDir', output], { cwd: root, env: { ...process.env, PAGES_BASE_PATH: base, VITE_GUESTBOOK_URL: '' }, stdio: 'pipe' });
      for (const path of paths) assert.deepEqual(await readFile(resolve(output, path.slice(1))), await readFile(resolve(root, 'public', path.slice(1))), `${base} ${path}`);
      const expected = await selectedPublicFiles(resolve(root, 'public'), base, []);
      const actual = await inventory(output);
      const sceneBundles = actual.filter(path => /^assets\/(?:cover-scene|garden-walk-renderer|three\.module)-[\w-]+\.js$/.test(path));
      for (const name of ['cover-scene', 'garden-walk-renderer', 'three.module']) {
        assert.equal(sceneBundles.filter(path => path.startsWith(`assets/${name}-`)).length, 1, `${base} ${name} bundle`);
      }
      assert.deepEqual(actual.filter(path => path !== 'index.html' && !sceneBundles.includes(path) && !/^assets\/(?:index-|photo-manager-dialog-)/.test(path)), expected);
    }
  } finally { await rm(scratch, { recursive: true, force: true }); }
});
