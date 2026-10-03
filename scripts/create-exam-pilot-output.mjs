import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(process.argv[2] ?? "docs");
const indexPath = resolve(output, "index.html");
if (!existsSync(indexPath)) throw new Error("Exam pilot build output is missing.");
const html = readFileSync(indexPath, "utf-8").replace(
  "</head>",
  '  <meta name="robots" content="noindex, nofollow" />\n  </head>'
);
writeFileSync(indexPath, html);
// Cloudflare Pages supplies SPA fallback when no root 404.html exists.
rmSync(resolve(output, "404.html"), { force: true });
rmSync(resolve(output, "sitemap.xml"), { force: true });
writeFileSync(resolve(output, "robots.txt"), "User-agent: *\nDisallow: /\n");
writeFileSync(resolve(output, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n");
console.log("Exam pilot output ready for Cloudflare Pages.");
