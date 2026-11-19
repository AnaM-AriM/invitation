import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionsUrl, inferRepository, MAX_BATCH_BYTES, MAX_PHOTO_BYTES, preflightPhotos, saveGitHubPhotos, validateRepository } from '../site/github-photos.ts';
const head = '1'.repeat(40), base = '2'.repeat(40), catalogSha = '3'.repeat(40), imageSha = '4'.repeat(40), newTree = '5'.repeat(40), newCommit = '6'.repeat(40);
const bytes = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const photo = (data = bytes, name = '한글.PNG') => ({ file: new File([data], name, { type: 'image/png' }), alt: '사진 설명' });
type Call = { url: string; init: RequestInit; body: Record<string, unknown> | undefined };
function api(options: { catalog?: unknown; truncated?: boolean; status?: number; lost?: boolean; mismatch?: boolean; corrupt?: boolean; patchStatus?: number; stalled?: boolean } = {}) {
  const calls: Call[] = [];
  const old = [{ src: '/photos/old.png', alt: '기존', credit: 'preserve metadata' }];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input), body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, init: init!, body });
    if (options.status) return new Response(JSON.stringify({ message: 'secret-token untrusted error body' }), { status: options.status });
    const method = init?.method;
    let result: unknown;
    if (method === 'GET' && url.endsWith('/git/ref/heads/main')) result = { ref: 'refs/heads/main', object: { type: 'commit', sha: head }, url: 'https://evil.test/' };
    else if (method === 'GET' && url.endsWith(`/git/commits/${head}`)) result = { sha: head, tree: { sha: base } };
    else if (method === 'GET' && url.endsWith('?recursive=1')) result = { sha: base, truncated: options.truncated ?? false, tree: [{ path: 'site/photos.json', type: 'blob', mode: '100644', sha: catalogSha }, { path: 'public/photos/old.png', type: 'blob', sha: '7'.repeat(40) }] };
    else if (method === 'GET' && url.endsWith(`/git/blobs/${catalogSha}`)) result = { sha: catalogSha, encoding: 'base64', content: options.corrupt ? '////' : Buffer.from(JSON.stringify(options.catalog ?? old)).toString('base64') };
    else if (method === 'POST' && url.endsWith('/git/blobs')) result = { sha: imageSha };
    else if (method === 'POST' && url.endsWith('/git/trees')) result = { sha: newTree };
    else if (method === 'POST' && url.endsWith('/git/commits')) result = { sha: newCommit, tree: { sha: newTree }, parents: [{ sha: head }] };
    else if (method === 'PATCH') { if (options.patchStatus) return new Response('{}', { status: options.patchStatus }); if (options.stalled) return await new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(Error('aborted')), { once: true })); if (options.lost) throw Error('secret-token'); result = { ref: 'refs/heads/main', object: { type: 'commit', sha: options.mismatch ? head : newCommit } }; }
    else throw Error(`Unexpected request ${method} ${url}`);
    return new Response(JSON.stringify(result), { status: method === 'POST' ? 201 : 200 });
  };
  return { calls, old, fetcher: fetcher as typeof fetch };
}
async function withApi(options: Parameters<typeof api>[0], run: (fixture: ReturnType<typeof api>) => Promise<void>) {
  const fixture = api(options), original = globalThis.fetch; globalThis.fetch = fixture.fetcher;
  try { await run(fixture); } finally { globalThis.fetch = original; }
}
test('raw repository validation rejects normalized, encoded, non-ASCII and traversal inputs', () => {
  for (const value of [' owner/repo', 'owner/repo ', 'owner/../repo', 'owner/%2e%2e', 'owner/repo%2fextra', 'owner/repo?x=1', 'https://evil.test/repo', 'owner/İ', 'owner\\repo', 'owner/repo\n', '-owner/repo', 'owner/a..b']) assert.throws(() => validateRepository(value));
  assert.equal(validateRepository('Owner/hello.world_1-2'), 'Owner/hello.world_1-2');
  assert.equal(actionsUrl('owner/repo'), 'https://github.com/owner/repo/actions');
  assert.equal(inferRepository('owner.github.io', '/invitation/'), 'owner/invitation');
  assert.equal(inferRepository('owner.github.io', '/'), 'owner/owner.github.io');
  assert.equal(inferRepository('owner.github.io.evil.test', '/'), '');
  assert.equal(inferRepository('owner.github.io', '/%2Frepo/'), '');
});
test('atomic transaction preserves old catalog, original bytes, base tree, exact parent and nonforce branch update', async () => withApi({}, async ({ calls, old }) => {
  const result = await saveGitHubPhotos('owner/repo', 'secret_token', [photo()]); assert.equal(result.commit, newCommit);
  assert.deepEqual(calls.map(call => call.init.method), ['GET','GET','GET','GET','POST','POST','POST','PATCH']);
  for (const call of calls) { assert.equal(new URL(call.url).origin, 'https://api.github.com'); assert.equal(call.init.redirect, 'error'); assert.equal(call.init.credentials, 'omit'); assert.equal((call.init.headers as Record<string, string>).Authorization, 'Bearer secret_token'); assert.ok(!call.url.includes('secret_token')); assert.ok(!JSON.stringify(call.body ?? {}).includes('secret_token')); }
  assert.deepEqual(Buffer.from(String(calls[4].body!.content), 'base64'), Buffer.from(bytes));
  const tree = calls[5].body!; assert.equal(tree.base_tree, base);
  const entries = tree.tree as { path: string; content?: string; mode: string; type: string; sha?: string }[];
  assert.match(entries[0].path, /^public\/photos\/[a-f0-9-]{36}\.png$/); assert.equal(entries[0].sha, imageSha);
  const catalog = JSON.parse(entries[1].content!); assert.deepEqual(catalog[0], old[0]); assert.equal(catalog[1].src, entries[0].path.slice(6)); assert.equal(catalog[1].alt, '사진 설명');
  assert.deepEqual(calls[6].body, { message: 'Add 1 invitation photo(s)', tree: newTree, parents: [head] }); assert.deepEqual(calls[7].body, { sha: newCommit, force: false });
}));
test('whole batch rejects invalid files before any API call', async () => withApi({}, async ({ calls }) => {
  for (const bad of [photo(bytes, 'bad.jpg'), photo(new Uint8Array(), 'empty.png'), photo(bytes, 'photo.gif'), { ...photo(), alt: ' ' }]) await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo(), bad]));
  await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo(), photo(new Uint8Array(MAX_PHOTO_BYTES + 1))]));
  await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', Array.from({ length: 11 }, () => photo())));
  assert.equal(calls.length, 0);
}));
test('10 MiB individual, 20 MiB batch and ten-file inclusive limits; total overflow rejected', async () => {
  const large = new Uint8Array(MAX_PHOTO_BYTES); large.set(bytes);
  const result = await preflightPhotos([photo(large), photo(large)]); assert.equal(result.reduce((n, p) => n + p.bytes.length, 0), MAX_BATCH_BYTES);
  assert.equal((await preflightPhotos(Array.from({ length: 10 }, () => photo()))).length, 10);
  await assert.rejects(preflightPhotos([photo(large), photo(large), photo()]));
});
test('truncated trees and malformed/invalid UTF8 catalogs cause zero writes', async () => {
  for (const options of [{ truncated: true }, { catalog: {} }, { catalog: [null] }, { catalog: [{ src: ' ', alt: 'x' }] }, { catalog: [{ src: '/x', alt: 7 }] }, { corrupt: true }]) await withApi(options, async ({ calls }) => { await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo()])); assert.ok(calls.every(c => c.init.method === 'GET')); });
});
test('status errors are actionable, safe and never reflect GitHub error text', async () => {
  for (const status of [401,403,404,409,422]) await withApi({ status }, async () => { await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo()]), error => { assert.ok(error instanceof Error); assert.ok(!error.message.includes('secret')); assert.match(error.message, /토큰|권한|main|저장소/); return true; }); });
});
test('lost PATCH response and unequal acknowledgement report uncertainty without automatic retry', async () => {
  for (const options of [{ lost: true }, { mismatch: true }]) await withApi(options, async ({ calls }) => { await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo()]), /저장 여부를 확인하지 못했어요.*재시도 전에/); assert.equal(calls.filter(c => c.init.method === 'PATCH').length, 1); });
});
test('concurrent branch and protected branch rejection never report success or retry', async () => {
  for (const patchStatus of [409,422]) await withApi({ patchStatus }, async ({ calls }) => { await assert.rejects(saveGitHubPhotos('owner/repo', 'secret_token', [photo()]), /main|保護|보호/); assert.equal(calls.filter(c => c.init.method === 'PATCH').length, 1); });
});
test('a stalled branch update times out and reports uncertain outcome', async context => withApi({ stalled: true }, async fixture => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let reached!: () => void; const atPatch = new Promise<void>(resolve => { reached = resolve; });
  const underlying = globalThis.fetch;
  globalThis.fetch = (input, init) => { const result = underlying(input, init); if (init?.method === 'PATCH') reached(); return result; };
  const pending = saveGitHubPhotos('owner/repo', 'secret_token', [photo()]);
  await atPatch; context.mock.timers.tick(60000);
  await assert.rejects(pending, /저장 여부를 확인하지 못했어요.*재시도 전에/);
  assert.equal(fixture.calls.filter(c => c.init.method === 'PATCH').length, 1);
}));
