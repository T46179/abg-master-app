import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as { version?: string };

function localFocusedDrills(): Plugin {
  return {
    name: "local-focused-drills",
    configureServer(server) {
      if (server.config.server.host !== "127.0.0.1" && server.config.server.host !== "localhost") return;
      const generator = pathToFileURL(resolve(server.config.root,
        "../abg-master-content/private-app-assets/abg-master-app/exam-runtime/supabase/functions/exam-drills/questions.ts"));
      server.middlewares.use("/__local/focused-drills", async (request, response) => {
        const send = (status: number, data: unknown) => {
          response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          response.end(JSON.stringify(data));
        };
        const host = request.headers.host ?? "";
        const origin = request.headers.origin;
        if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)
          || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress ?? "")
          || (origin && origin !== `http://${host}`)) return send(403, { code: "LOOPBACK_ONLY" });
        if (request.method !== "POST") return send(405, { code: "POST_REQUIRED" });

        let input: unknown;
        try {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of request) {
            const buffer = Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > 1024) return send(413, { code: "REQUEST_TOO_LARGE" });
            chunks.push(buffer);
          }
          input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return send(400, { code: "INVALID_DRILL_REQUEST" });
        }
        try {
          generator.searchParams.set("version", String(statSync(generator).mtimeMs));
          const { parseDrillRequest, generateDrill } = await import(generator.href);
          const checked = parseDrillRequest(input);
          if (!checked) return send(400, { code: "INVALID_DRILL_REQUEST" });
          return send(200, generateDrill(checked));
        } catch {
          return send(503, { code: "LOCAL_GENERATOR_UNAVAILABLE" });
        }
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  if (mode === "account-staging" && command !== "serve") throw new Error("Account staging is a local preview only.");
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
      outDir: mode === "exam-pilot" ? "dist/exam-pilot" : "docs"
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version ?? "0.0.0")
    },
    plugins: [react(), ...(command === "serve" && mode === "development" ? [localFocusedDrills()] : [])],
    server: {
      host: "127.0.0.1",
      ...((mode === "account-staging" || mode === "development") ? { proxy: {
        "/__account-staging/runtime_bootstrap.json": {
          target: "https://staging.abgmaster.com", changeOrigin: true,
          rewrite: () => "/runtime_bootstrap.json"
        }
      } } : {})
    },
    preview: {
      host: "127.0.0.1"
    }
  };
});
