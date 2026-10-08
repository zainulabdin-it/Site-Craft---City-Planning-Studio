import { defineConfig } from "vite";
export default defineConfig({
  define: { CESIUM_BASE_URL: JSON.stringify("/cesium") },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
  build: { chunkSizeWarningLimit: 1600 },
});
