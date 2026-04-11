import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");

if (!existsSync(indexPath)) {
  throw new Error(`Build output not found: ${indexPath}`);
}

// GitHub Pages serves 404.html for unknown paths, so copying the SPA entry
// lets routes like /practice boot the app instead of showing a static 404.
copyFileSync(indexPath, fallbackPath);
