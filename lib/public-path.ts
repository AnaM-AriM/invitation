declare const __PUBLIC_BASE__: string | undefined;
/** Vite defines the Pages base; the original worker application stays at /. */
export function publicPath(path: string, base = typeof __PUBLIC_BASE__ === "undefined" ? "/" : __PUBLIC_BASE__): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}
