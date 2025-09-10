import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "deals",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx",
      },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: "^18.0.0" },
        "react-dom": { singleton: true, eager: true, requiredVersion: "^18.0.0" },
        // "react-router-dom": { singleton: true, eager: true },
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['openai']
  },
  build: { target: "esnext", modulePreload: false, cssCodeSplit: true },
  define: { global: "globalThis" },
  server: { host: true, port: 5176 },
});
