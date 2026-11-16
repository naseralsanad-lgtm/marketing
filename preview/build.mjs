// Builds the single-page preview (preview/dist/index.html + app.js) from the real application code.
// Run `npm run build` first so the compiled stylesheet exists, then `node preview/build.mjs`.
import { build } from "esbuild";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."); const out = path.join(root, "preview/dist"); mkdirSync(out, { recursive: true });
const shim = (f) => path.join(root, "preview/shims", f);
await build({
  entryPoints: [path.join(root, "preview/main.tsx")], outfile: path.join(out, "app.js"), bundle: true, minify: true, format: "iife", platform: "browser", target: "es2020", jsx: "automatic", legalComments: "none",
  alias: { "@": path.join(root, "src"), "next/link": shim("navigation.tsx"), "next/navigation": shim("navigation.tsx"), "@supabase/supabase-js": shim("supabase.ts"), "node:fs": shim("empty.ts"), "node:https": shim("empty.ts"), fs: shim("empty.ts"), https: shim("empty.ts") },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_PREVIEW": '"1"', "process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined", "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": "undefined", global: "window" },
  logLevel: "warning",
});
const cssDir = path.join(root, ".next/static/chunks");
const css = readdirSync(cssDir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(path.join(cssDir, f), "utf8")).join("\n");
writeFileSync(path.join(out, "index.html"), `<title>Marketing Planner</title>
<style>${css}
/* preview host: fill the frame instead of the viewport */
html, body, #mp-root { height: 100%; }
body { background: var(--bg); color: var(--ink); }
.h-screen { height: 100%; }
</style>
<div id="mp-root"></div>
<script src="app.js"></script>
`);
console.log("preview built:", out);
