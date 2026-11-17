import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    // The landing page's WebGL chunk (three.js) is loaded lazily and is the only chunk above the default limit.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Override when the API runs elsewhere, e.g. API_PROXY_TARGET=http://localhost:8799 npm run dev:web
        target: process.env.API_PROXY_TARGET ?? "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
