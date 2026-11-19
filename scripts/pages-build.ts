import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { publicPath } from "../lib/public-path.ts";
export const excludedVersions = ["v2", "v3", "v4", "v5", "v6", "v7", "v12", "v13", "v14", "v16"];
type Photo = { src: string };
async function publicFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const name of await readdir(directory)) {
    const path = prefix + name;
    if ((await stat(resolve(directory, name))).isDirectory()) files.push(...await publicFiles(resolve(directory, name), `${path}/`));
    else files.push(path);
  }
  return files.sort();
}
export async function selectedPublicFiles(directory: string, base: string, photos: Photo[], cover?: Photo): Promise<string[]> {
  const files = await publicFiles(directory), retained = new Set<string>();
  for (const photo of [...photos, ...(cover ? [cover] : [])]) {
    const src = photo.src;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src)) continue;
    try {
      // Resolve exactly as the gallery does; uncertain local paths keep historical art.
      if (!src || /[\\\u0000-\u0020]/.test(src) || /(?:^|\/)\.{2}(?:\/|$)/.test(src.split(/[?#]/)[0])) return files;
      const url = new URL(publicPath(src, base), `https://pages.invalid${base}`);
      if (!url.pathname.startsWith(base)) return files;
      const encoded = url.pathname.slice(base.length);
      if (/%(?:2f|5c|00)/i.test(encoded)) return files;
      const path = decodeURIComponent(encoded);
      if (path.split('/').some(part => part === '..' || part === '.')) return files;
      if (!files.includes(path)) return files;
      const version = /^assets\/(v\d+)\//.exec(path)?.[1];
      if (version) retained.add(version);
    } catch { return files; }
  }
  return files.filter(path => !excludedVersions.some(version => !retained.has(version) && path.startsWith(`assets/${version}/`)));
}
export async function copyPagesPublic(directory: string, output: string, base: string, photos: Photo[], cover?: Photo) {
  for (const path of await selectedPublicFiles(directory, base, photos, cover)) {
    const destination = resolve(output, path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(resolve(directory, path), destination);
  }
}
export function projectGuestMotion(source: { action: unknown; facing: unknown; still?: unknown }[]) {
  return source.map(item => ({ action: item.action, facing: item.facing, ...(Object.hasOwn(item, "still") ? { still: item.still } : {}) }));
}
