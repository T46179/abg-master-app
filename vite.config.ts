import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as { version?: string };

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0")
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1"
  },
  preview: {
    host: "127.0.0.1"
  }
});
