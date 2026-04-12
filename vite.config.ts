import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "client",
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  appType: "spa", // serves index.html for all routes (SPA fallback)
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
