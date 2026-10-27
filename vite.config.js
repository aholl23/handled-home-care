// Cloudflare Pages runs `vite build` on this repo and publishes dist/.
// Vite bundles the CSS but skips plain <script src> files and other static files,
// so copy them into dist/ after the build. Without this, js/app.js is missing live
// and nothing interactive works (animations, example texts, the request form).
import { defineConfig } from "vite";
import { cpSync, existsSync } from "node:fs";

const STATIC = ["js", "fonts", "assets", "favicon.ico", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "_headers", "_redirects"];

export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true },
  plugins: [{
    name: "copy-static-site",
    closeBundle() {
      for (const p of STATIC) if (existsSync(p)) cpSync(p, `dist/${p}`, { recursive: true });
    },
  }],
});
