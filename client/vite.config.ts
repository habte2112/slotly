import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_DESCRIPTION =
  "Slotly: book salon and clinic appointments online with live availability and instant email confirmation.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// የሳሎኑን ስም እና አርማ (VITE_BRAND_*) ወደ index.html፣ ወደ PWA manifest እና ወደ dist ያስገባል
function brand(env: Record<string, string>): Plugin {
  const name = env.VITE_BRAND_NAME || "Slotly";
  const short = env.VITE_BRAND_SHORT || name;
  const description = env.VITE_BRAND_DESCRIPTION || DEFAULT_DESCRIPTION;
  const assets = env.VITE_BRAND_ASSETS || ""; // ለምሳሌ "fitawrari" → client/brand/fitawrari/
  let root = process.cwd();
  let outDir = "dist";
  let isBuild = false;

  return {
    name: "brand",
    configResolved(cfg) {
      root = cfg.root;
      outDir = cfg.build.outDir;
      isBuild = cfg.command === "build";
    },
    transformIndexHtml(html) {
      let out = html
        .replace(/\{\{BRAND_NAME\}\}/g, () => esc(name))
        .replace(/\{\{BRAND_SHORT\}\}/g, () => esc(short))
        .replace(/\{\{BRAND_DESCRIPTION\}\}/g, () => esc(description));
      if (assets) {
        out = out.replace(
          '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
          '<link rel="icon" type="image/png" href="/favicon.png" />',
        );
      }
      return out;
    },
    closeBundle() {
      if (!isBuild) return;
      // የሳሎኑ አዶዎች የ Slotly አዶዎችን በ dist ውስጥ ይተካሉ
      if (assets) {
        const dir = resolve(root, "brand", assets);
        if (existsSync(dir)) {
          for (const f of readdirSync(dir)) copyFileSync(resolve(dir, f), resolve(root, outDir, f));
        } else {
          console.warn(`[brand] folder not found: ${dir}`);
        }
      }
      // manifest ቋሚ ፋይል ስለሆነ ከ build በኋላ ስሙን ይተካል
      const file = resolve(root, outDir, "manifest.webmanifest");
      if (!existsSync(file)) return;
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      manifest.name = name;
      manifest.short_name = short;
      writeFileSync(file, JSON.stringify(manifest, null, 2));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), tailwindcss(), brand(env)],
    server: {
      port: 5173,
      // /api ጥያቄዎችን ወደ backend ያስተላልፋል (CORS ችግር የለም)
      proxy: { "/api": "http://localhost:4000" },
    },
  };
});