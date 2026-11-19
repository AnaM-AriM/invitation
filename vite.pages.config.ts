import { defineConfig, type ResolvedConfig } from "vite";
import { resolve } from "node:path";
import { copyPagesPublic, projectGuestMotion } from "./scripts/pages-build";
import { wedding } from "./site/wedding";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const base = process.env.PAGES_BASE_PATH || "/";
if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(base)) throw new Error("PAGES_BASE_PATH must be / or /repository/");
const publicDirectory = fileURLToPath(new URL("./public", import.meta.url));
const motionFile = fileURLToPath(new URL("./lib/guest-motion.json", import.meta.url));
let config: ResolvedConfig;
export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./site", import.meta.url)), base,
  publicDir: command === "build" ? false : publicDirectory,
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), {
    name: "pages-build", apply: "build", enforce: "pre",
    configResolved(resolved) { config = resolved; },
    transform(source, id) {
      if (id === motionFile) return JSON.stringify(projectGuestMotion(JSON.parse(source)));
    },
    async writeBundle() { await copyPagesPublic(publicDirectory, resolve(config.root, config.build.outDir), base, wedding.photos, wedding.coverPhoto); },
  }, { name: "wedding-metadata", transformIndexHtml(html) {
    const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const title = `${wedding.isExample ? "[예시] " : ""}${wedding.couple[0].name} · ${wedding.couple[1].name}의 결혼식`;
    const description = `${wedding.isExample ? "예시 청첩장입니다. " : ""}${wedding.dateTime.slice(0, 10)} · ${wedding.venue.name} · 소중한 분들을 초대합니다.`;
    return html.replace(/<title>.*?<\/title>/, `<title>${escape(title)}</title>`).replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(description)}"/>`) .replace("</head>", `<meta property="og:type" content="website"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/></head>`);
  } }], define: { __PUBLIC_BASE__: JSON.stringify(base) },
  build: { outDir: "../out", emptyOutDir: true },
  server: { host: "127.0.0.1" }, preview: { host: "127.0.0.1" },
}));
