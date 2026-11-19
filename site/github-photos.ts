export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS = 10;
export type PhotoInput = { file: File; alt: string };
type CatalogPhoto = { src: string; alt: string; [key: string]: unknown };
const shaPattern = /^[a-f0-9]{40}$/;
const uncertain = "저장 여부를 확인하지 못했어요. 재시도 전에 GitHub의 main 커밋과 사진 목록을 확인해 주세요. 중복 저장될 수 있습니다.";
export class PhotoSaveError extends Error {}
function fail(message = "GitHub 응답을 확인하지 못했어요. 저장소 상태를 확인해 주세요."): never { throw new PhotoSaveError(message); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function sha(value: unknown): string { if (typeof value !== "string" || !shaPattern.test(value)) fail(); return value; }
export function validateRepository(repository: string): string {
  // Validate the raw value, before URL parsing or normalization.
  if (typeof repository !== "string" || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$/.test(repository) || repository.split("/")[1].includes("..")) fail("저장소를 owner/repository 형식의 영문 이름으로 입력해 주세요.");
  return repository;
}
export function inferRepository(hostname: string, pathname: string): string {
  const match = /^([a-zA-Z0-9-]+)\.github\.io$/.exec(hostname);
  if (!match) return "";
  const repo = pathname.split("/")[1] || `${match[1]}.github.io`;
  try { return validateRepository(`${match[1]}/${repo}`); } catch { return ""; }
}
export function actionsUrl(repository: string): string { return `https://github.com/${validateRepository(repository)}/actions`; }
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(binary);
}
export async function preflightPhotos(photos: PhotoInput[]): Promise<{ bytes: Uint8Array; extension: string; alt: string }[]> {
  if (!Array.isArray(photos) || !photos.length || photos.length > MAX_PHOTOS) fail("사진은 한 번에 1–10장 선택해 주세요.");
  let total = 0;
  // Check the entire batch's declared sizes before reading or writing anything.
  for (const photo of photos) {
    if (!photo || !(photo.file instanceof Blob) || typeof photo.file.name !== "string" || typeof photo.alt !== "string" || !photo.alt.trim()) fail("사진과 사진 설명을 확인해 주세요.");
    if (!Number.isSafeInteger(photo.file.size) || photo.file.size <= 0 || photo.file.size > MAX_PHOTO_BYTES) fail("사진 한 장은 0바이트 초과, 10 MiB 이하여야 해요.");
    total += photo.file.size;
  }
  if (total > MAX_BATCH_BYTES) fail("사진의 전체 크기는 20 MiB 이하여야 해요.");
  const prepared = [];
  for (const { file, alt } of photos) {
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await file.arrayBuffer()); } catch { fail("사진 파일을 읽지 못했어요. 다시 선택해 주세요."); }
    if (bytes.length !== file.size) fail("사진 파일의 크기를 확인하지 못했어요.");
    const ext = /\.([a-zA-Z]+)$/.exec(file.name)?.[1].toLowerCase();
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = [137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b);
    const webp = String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
    if (!((ext === "jpg" || ext === "jpeg") && jpeg || ext === "png" && png || ext === "webp" && webp)) fail("JPEG, PNG, WebP 확장자와 파일 내용이 일치해야 해요.");
    if (typeof createImageBitmap === "function") {
      try { const image = await createImageBitmap(file); const valid = image.width > 0 && image.height > 0; image.close(); if (!valid) fail(); } catch { fail("열 수 없는 사진이 있어요. 올바른 이미지 파일을 다시 선택해 주세요."); }
    }
    prepared.push({ bytes, extension: ext!, alt });
  }
  return prepared;
}
export async function saveGitHubPhotos(repository: string, token: string, photos: PhotoInput[]): Promise<{ commit: string; actions: string }> {
  validateRepository(repository);
  if (typeof token !== "string" || !/^[A-Za-z0-9_]+$/.test(token)) fail("GitHub 토큰을 확인해 주세요.");
  const prepared = await preflightPhotos(photos);
  const origin = `https://api.github.com/repos/${repository}`;
  async function request(path: string, method = "GET", body?: unknown): Promise<Record<string, unknown>> {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
    try { response = await fetch(`${origin}${path}`, { method, signal: controller.signal, redirect: "error", credentials: "omit", cache: "no-store", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { fail(method === "PATCH" ? uncertain : "GitHub에 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요."); }
    const errors: Record<number, string> = { 401: "GitHub 토큰이 유효하지 않거나 만료되었어요. 새 토큰을 입력해 주세요.", 403: "저장 권한이 없거나 API 한도에 도달했어요. 선택한 저장소의 Contents 쓰기 권한과 GitHub 상태를 확인해 주세요.", 404: "저장소 또는 main 브랜치를 찾지 못했어요. 저장소 이름과 토큰의 접근 권한을 확인해 주세요.", 409: "main이 변경되었거나 충돌했어요. GitHub 상태를 확인한 뒤 다시 시도해 주세요.", 422: "GitHub가 저장을 거절했어요. main의 변경 또는 보호 규칙을 확인해 주세요." };
    if (!response.ok) fail(errors[response.status] || (method === "PATCH" ? uncertain : "GitHub 요청이 실패했어요. 저장소 상태를 확인해 주세요."));
    try { return object(await response.json()); } catch { fail(method === "PATCH" ? uncertain : undefined); }
    } finally { clearTimeout(timeout); }
  }
  const ref = await request("/git/ref/heads/main");
  if (ref.ref !== "refs/heads/main" || object(ref.object).type !== "commit") fail();
  const head = sha(object(ref.object).sha);
  const commit = await request(`/git/commits/${head}`);
  if (commit.sha !== head) fail();
  const baseTree = sha(object(commit.tree).sha);
  const tree = await request(`/git/trees/${baseTree}?recursive=1`);
  if (tree.sha !== baseTree || tree.truncated !== false || !Array.isArray(tree.tree)) fail("파일 목록을 완전히 확인하지 못했어요. 저장을 중단했어요.");
  const entries = tree.tree.map(object);
  const catalogEntry = entries.find(entry => entry.path === "site/photos.json");
  if (!catalogEntry || catalogEntry.type !== "blob" || !["100644", "100755"].includes(String(catalogEntry.mode))) fail("이 저장소의 site/photos.json이 필요해요. 먼저 이 청첩장 코드를 main에 배포해 주세요.");
  for (const parent of ["public", "public/photos"]) if (entries.some(entry => entry.path === parent && entry.type !== "tree")) fail("사진 폴더 경로를 확인해 주세요. 일반 폴더가 필요해요.");
  const catalogSha = sha(catalogEntry.sha);
  const blob = await request(`/git/blobs/${catalogSha}`);
  let catalog: CatalogPhoto[];
  try {
    if (blob.sha !== catalogSha || blob.encoding !== "base64" || typeof blob.content !== "string") fail();
    const raw = blob.content.replace(/\n/g, "");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) fail();
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(raw), c => c.charCodeAt(0))));
    if (!Array.isArray(parsed) || parsed.some(p => !p || typeof p !== "object" || Array.isArray(p) || typeof p.src !== "string" || !p.src.trim() || typeof p.alt !== "string")) fail();
    catalog = parsed as CatalogPhoto[];
  } catch { fail("기존 사진 목록 형식을 확인해 주세요. 기존 목록을 덮어쓰지 않았어요."); }
  const usedPaths = new Set(entries.map(entry => entry.path));
  const usedSources = new Set(catalog.map(photo => photo.src));
  const additions = prepared.map(photo => {
    let path: string, src: string;
    do { path = `public/photos/${crypto.randomUUID()}.${photo.extension}`; src = path.slice("public".length); } while (usedPaths.has(path) || usedSources.has(src));
    usedPaths.add(path); usedSources.add(src);
    return { ...photo, path, src };
  });
  const newEntries = [];
  for (const photo of additions) {
    const created = await request("/git/blobs", "POST", { content: base64(photo.bytes), encoding: "base64" });
    newEntries.push({ path: photo.path, mode: "100644", type: "blob", sha: sha(created.sha) });
  }
  const newTree = sha((await request("/git/trees", "POST", { base_tree: baseTree, tree: [...newEntries, { path: "site/photos.json", mode: "100644", type: "blob", content: `${JSON.stringify([...catalog, ...additions.map(({ src, alt }) => ({ src, alt }))], null, 2)}\n` }] })).sha);
  const createdCommit = await request("/git/commits", "POST", { message: `Add ${additions.length} invitation photo(s)`, tree: newTree, parents: [head] });
  const newCommit = sha(createdCommit.sha);
  if (object(createdCommit.tree).sha !== newTree || !Array.isArray(createdCommit.parents) || createdCommit.parents.length !== 1 || object(createdCommit.parents[0]).sha !== head) fail();
  const updated = await request("/git/refs/heads/main", "PATCH", { sha: newCommit, force: false });
  // An invalid acknowledgement is ambiguous: the branch may already have moved.
  try { if (updated.ref !== "refs/heads/main" || object(updated.object).type !== "commit" || object(updated.object).sha !== newCommit) fail(); } catch { fail(uncertain); }
  return { commit: newCommit, actions: actionsUrl(repository) };
}
