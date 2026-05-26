import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    federation({
        name: "deals",
        filename: "remoteEntry.js",
        exposes: {
          "./SmartCRMApp": "./src/SmartCRMApp.tsx",
          "./App": "./src/App.tsx",
        },
        shared: {
          react: { singleton: true, requiredVersion: '^18.2.0', eager: false },
          'react-dom': { singleton: true, requiredVersion: '^18.2.0', eager: false },
          'react-router-dom': { singleton: true },
          zustand: { singleton: true }
        }
      }),
  ],
  optimizeDeps: {
    exclude: ['openai'],
    include: ['@supabase/supabase-js', 'lucide-react']
  },
  build: {
    target: "esnext",
    modulePreload: false,
    cssCodeSplit: false,
    // Production optimizations
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'recharts'],
          ai: ['openai']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable gzip compression
    reportCompressedSize: false
  },
  define: {
    global: "globalThis",
    // Production environment variables
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  server: {
    host: true,
    port: 5176,
    // Enable CORS for development
    cors: true
  },
  // Production preview server
  preview: {
    port: 4173,
    host: true,
    cors: true
  },
  // Environment variables
  envPrefix: ['VITE_', 'SUPABASE_']
}));
