// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import federation from "file:///home/project/node_modules/@originjs/vite-plugin-federation/dist/index.mjs";
var vite_config_default = defineConfig(({ mode }) => ({
  plugins: [
    react(),
    federation({
      name: "deals",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx"
      },
      shared: ["react", "react-dom"]
    })
  ],
  optimizeDeps: {
    exclude: ["openai"],
    include: ["@supabase/supabase-js", "lucide-react"]
  },
  build: {
    target: "esnext",
    modulePreload: false,
    cssCodeSplit: true,
    // Production optimizations
    minify: mode === "production" ? "esbuild" : false,
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          ui: ["lucide-react", "recharts"],
          ai: ["openai"]
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1e3,
    // Enable gzip compression
    reportCompressedSize: false
  },
  define: {
    global: "globalThis",
    // Production environment variables
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "1.0.0"),
    __BUILD_TIME__: JSON.stringify((/* @__PURE__ */ new Date()).toISOString())
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
  envPrefix: ["VITE_", "SUPABASE_"]
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGZlZGVyYXRpb24gZnJvbSBcIkBvcmlnaW5qcy92aXRlLXBsdWdpbi1mZWRlcmF0aW9uXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIGZlZGVyYXRpb24oe1xuICAgICAgbmFtZTogXCJkZWFsc1wiLFxuICAgICAgZmlsZW5hbWU6IFwicmVtb3RlRW50cnkuanNcIixcbiAgICAgIGV4cG9zZXM6IHtcbiAgICAgICAgXCIuL0FwcFwiOiBcIi4vc3JjL0FwcC50c3hcIixcbiAgICAgIH0sXG4gICAgICBzaGFyZWQ6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCJdLFxuICAgIH0pLFxuICBdLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ29wZW5haSddLFxuICAgIGluY2x1ZGU6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJywgJ2x1Y2lkZS1yZWFjdCddXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiBcImVzbmV4dFwiLFxuICAgIG1vZHVsZVByZWxvYWQ6IGZhbHNlLFxuICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcbiAgICAvLyBQcm9kdWN0aW9uIG9wdGltaXphdGlvbnNcbiAgICBtaW5pZnk6IG1vZGUgPT09ICdwcm9kdWN0aW9uJyA/ICdlc2J1aWxkJyA6IGZhbHNlLFxuICAgIHNvdXJjZW1hcDogbW9kZSA9PT0gJ2RldmVsb3BtZW50JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgLy8gVmVuZG9yIGNodW5rcyBmb3IgYmV0dGVyIGNhY2hpbmdcbiAgICAgICAgICB2ZW5kb3I6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAgICAgc3VwYWJhc2U6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXG4gICAgICAgICAgdWk6IFsnbHVjaWRlLXJlYWN0JywgJ3JlY2hhcnRzJ10sXG4gICAgICAgICAgYWk6IFsnb3BlbmFpJ11cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG4gICAgLy8gSW5jcmVhc2UgY2h1bmsgc2l6ZSB3YXJuaW5nIGxpbWl0XG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxuICAgIC8vIEVuYWJsZSBnemlwIGNvbXByZXNzaW9uXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlXG4gIH0sXG4gIGRlZmluZToge1xuICAgIGdsb2JhbDogXCJnbG9iYWxUaGlzXCIsXG4gICAgLy8gUHJvZHVjdGlvbiBlbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBfX0FQUF9WRVJTSU9OX186IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52Lm5wbV9wYWNrYWdlX3ZlcnNpb24gfHwgJzEuMC4wJyksXG4gICAgX19CVUlMRF9USU1FX186IEpTT04uc3RyaW5naWZ5KG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSlcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogdHJ1ZSxcbiAgICBwb3J0OiA1MTc2LFxuICAgIC8vIEVuYWJsZSBDT1JTIGZvciBkZXZlbG9wbWVudFxuICAgIGNvcnM6IHRydWVcbiAgfSxcbiAgLy8gUHJvZHVjdGlvbiBwcmV2aWV3IHNlcnZlclxuICBwcmV2aWV3OiB7XG4gICAgcG9ydDogNDE3MyxcbiAgICBob3N0OiB0cnVlLFxuICAgIGNvcnM6IHRydWVcbiAgfSxcbiAgLy8gRW52aXJvbm1lbnQgdmFyaWFibGVzXG4gIGVudlByZWZpeDogWydWSVRFXycsICdTVVBBQkFTRV8nXVxufSkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxnQkFBZ0I7QUFFdkIsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixXQUFXO0FBQUEsTUFDVCxNQUFNO0FBQUEsTUFDTixVQUFVO0FBQUEsTUFDVixTQUFTO0FBQUEsUUFDUCxTQUFTO0FBQUEsTUFDWDtBQUFBLE1BQ0EsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLElBQy9CLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsUUFBUTtBQUFBLElBQ2xCLFNBQVMsQ0FBQyx5QkFBeUIsY0FBYztBQUFBLEVBQ25EO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsSUFDZixjQUFjO0FBQUE7QUFBQSxJQUVkLFFBQVEsU0FBUyxlQUFlLFlBQVk7QUFBQSxJQUM1QyxXQUFXLFNBQVM7QUFBQSxJQUNwQixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUE7QUFBQSxVQUVaLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFBQSxVQUM3QixVQUFVLENBQUMsdUJBQXVCO0FBQUEsVUFDbEMsSUFBSSxDQUFDLGdCQUFnQixVQUFVO0FBQUEsVUFDL0IsSUFBSSxDQUFDLFFBQVE7QUFBQSxRQUNmO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsdUJBQXVCO0FBQUE7QUFBQSxJQUV2QixzQkFBc0I7QUFBQSxFQUN4QjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sUUFBUTtBQUFBO0FBQUEsSUFFUixpQkFBaUIsS0FBSyxVQUFVLFFBQVEsSUFBSSx1QkFBdUIsT0FBTztBQUFBLElBQzFFLGdCQUFnQixLQUFLLFdBQVUsb0JBQUksS0FBSyxHQUFFLFlBQVksQ0FBQztBQUFBLEVBQ3pEO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQSxJQUVOLE1BQU07QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUVBLFdBQVcsQ0FBQyxTQUFTLFdBQVc7QUFDbEMsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
