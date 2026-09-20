import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// AFTERPRINT — static, frontend-only. No SSR, no server, no API.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 9000,
  },
});
