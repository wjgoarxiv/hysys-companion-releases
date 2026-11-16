import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appVersion: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const polling = process.platform === "linux" && process.cwd().startsWith("/mnt/");

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: { port: 5180, watch: polling ? { usePolling: true, interval: 300 } : undefined },
  build: { outDir: "dist", emptyOutDir: true, target: "chrome105" },
});
