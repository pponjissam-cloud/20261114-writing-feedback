/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  // GitHub Pages 하위 경로 배포 시 VITE_BASE=/repo-name/ 으로 지정
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { genai: ["@google/genai"], react: ["react", "react-dom", "react-router"], zod: ["zod", "zod-to-json-schema"] },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: { VITE_MOCK: "false" },
  },
});
