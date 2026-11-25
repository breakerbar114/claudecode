import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8787" } },
  define: mode === "artifact" ? { __RATES_SNAPSHOT__: process.env.RATES_SNAPSHOT || "null" } : {},
  build: mode === "artifact" ? { outDir: "dist-artifact", assetsInlineLimit: 100000000, cssCodeSplit: false, modulePreload: false } : {},
  test: { globals: true },
}));
