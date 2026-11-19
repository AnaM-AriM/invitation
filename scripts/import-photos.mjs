import { constants } from 'node:fs';
import { access, copyFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalogPath = resolve(root, 'site/photos.json');
const directory = resolve(root, 'public/photos');
const copied = [];
let temporary;
try {
  const inputs = process.argv.slice(2);
  if (!inputs.length) throw new Error('사용법: npm run photos:add -- 사진.jpg [사진.png ...]');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (!Array.isArray(catalog) || catalog.some(photo => !photo || typeof photo.src !== 'string' || !photo.src.trim() || typeof photo.alt !== 'string')) throw new Error('site/photos.json은 src와 alt 문자열을 가진 사진 배열이어야 합니다.');
  // Preflight the entire batch before copying any photo.
  const photos = [];
  for (const input of inputs) {
    const source = resolve(input), extension = extname(source).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('JPEG, PNG, WebP 파일만 추가할 수 있습니다.');
    const info = await stat(source);
    if (!info.isFile() || info.size === 0 || info.size > 10 * 1024 * 1024) throw new Error('사진은 0바이트 초과, 10 MiB 이하의 일반 파일이어야 합니다.');
    await access(source, constants.R_OK);
    const handle = await open(source, 'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
    const matches = extension === '.png' ? header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : extension === '.webp' ? header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP' : header[0] === 255 && header[1] === 216 && header[2] === 255;
    if (!matches) throw new Error('사진 확장자와 파일 헤더가 일치하지 않습니다.');
    const stem = basename(source, extname(source)).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'photo';
    photos.push({ source, extension, stem });
  }
  await mkdir(directory, { recursive: true });
  for (const photo of photos) {
    let suffix = 0;
    while (true) {
      const name = `${photo.stem}${suffix ? `-${suffix}` : ''}${photo.extension}`;
      const destination = resolve(directory, name);
      if (catalog.some(entry => entry.src === `/photos/${name}`)) { suffix++; continue; }
      try { await copyFile(photo.source, destination, constants.COPYFILE_EXCL); }
      catch (error) { if (error.code === 'EEXIST') { suffix++; continue; } throw error; }
      copied.push(destination);
      catalog.push({ src: `/photos/${name}`, alt: '두 사람이 함께한 순간' });
      break;
    }
  }
  temporary = `${catalogPath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, catalogPath);
  temporary = undefined;
  console.log(`사진 ${photos.length}장을 추가했어요. site/photos.json에서 설명과 순서를 수정하세요.`);
} catch (error) {
  await Promise.all(copied.map(path => unlink(path).catch(() => {})));
  if (temporary) await unlink(temporary).catch(() => {});
  const message = error instanceof SyntaxError ? 'site/photos.json의 JSON 형식을 확인해 주세요.' : error.code ? `사진 파일을 읽거나 저장하지 못했어요 (${error.code}). 경로와 권한을 확인해 주세요.` : error.message;
  console.error(message);
  process.exitCode = 1;
}
