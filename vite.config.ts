import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as { version?: string };

export default defineConfig(({ mode }) => {
  if (mode === "exam-pilot") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const stagingUrl = "https://clpfecuohwzwrgmqzeos.supabase.co";
    if (env.VITE_EXAM_PILOT_SUPABASE_URL !== stagingUrl || !env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY) {
      throw new Error("Exam pilot builds require the staging Exam URL and public anon key.");
    }
    if (env.VITE_SUPABASE_URL !== stagingUrl || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error("Exam pilot builds also require the staging Practice URL and public anon key.");
    }
    for (const key of [env.VITE_EXAM_PILOT_SUPABASE_ANON_KEY, env.VITE_SUPABASE_ANON_KEY]) {
      if (!key) continue;
      if (key.startsWith("sb_publishable_")) continue;
      let role: unknown;
      try { role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role; } catch { /* Invalid public key. */ }
      if (role !== "anon") throw new Error("Exam pilot builds accept only public Supabase keys.");
    }
  }
  return {
    base: "/",
    build: {
      outDir: "docs"
    },
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
  };
});
