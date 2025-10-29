// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.js";
import federation from "file:///home/project/node_modules/@originjs/vite-plugin-federation/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    federation({
      name: "deals",
      filename: "remoteEntry.js",
      exposes: {
        "./App": "./src/App.tsx"
      },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: "^18.0.0" },
        "react-dom": { singleton: true, eager: true, requiredVersion: "^18.0.0" }
        // "react-router-dom": { singleton: true, eager: true },
      }
    })
  ],
  optimizeDeps: {
    exclude: ["openai"]
  },
  build: { target: "esnext", modulePreload: false, cssCodeSplit: true },
  define: { global: "globalThis" },
  server: { host: true, port: 5176 }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IGZlZGVyYXRpb24gZnJvbSBcIkBvcmlnaW5qcy92aXRlLXBsdWdpbi1mZWRlcmF0aW9uXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIGZlZGVyYXRpb24oe1xuICAgICAgbmFtZTogXCJkZWFsc1wiLFxuICAgICAgZmlsZW5hbWU6IFwicmVtb3RlRW50cnkuanNcIixcbiAgICAgIGV4cG9zZXM6IHtcbiAgICAgICAgXCIuL0FwcFwiOiBcIi4vc3JjL0FwcC50c3hcIixcbiAgICAgIH0sXG4gICAgICBzaGFyZWQ6IHtcbiAgICAgICAgcmVhY3Q6IHsgc2luZ2xldG9uOiB0cnVlLCBlYWdlcjogdHJ1ZSwgcmVxdWlyZWRWZXJzaW9uOiBcIl4xOC4wLjBcIiB9LFxuICAgICAgICBcInJlYWN0LWRvbVwiOiB7IHNpbmdsZXRvbjogdHJ1ZSwgZWFnZXI6IHRydWUsIHJlcXVpcmVkVmVyc2lvbjogXCJeMTguMC4wXCIgfSxcbiAgICAgICAgLy8gXCJyZWFjdC1yb3V0ZXItZG9tXCI6IHsgc2luZ2xldG9uOiB0cnVlLCBlYWdlcjogdHJ1ZSB9LFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogWydvcGVuYWknXVxuICB9LFxuICBidWlsZDogeyB0YXJnZXQ6IFwiZXNuZXh0XCIsIG1vZHVsZVByZWxvYWQ6IGZhbHNlLCBjc3NDb2RlU3BsaXQ6IHRydWUgfSxcbiAgZGVmaW5lOiB7IGdsb2JhbDogXCJnbG9iYWxUaGlzXCIgfSxcbiAgc2VydmVyOiB7IGhvc3Q6IHRydWUsIHBvcnQ6IDUxNzYgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxnQkFBZ0I7QUFFdkIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sV0FBVztBQUFBLE1BQ1QsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLFFBQ1AsU0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNOLE9BQU8sRUFBRSxXQUFXLE1BQU0sT0FBTyxNQUFNLGlCQUFpQixVQUFVO0FBQUEsUUFDbEUsYUFBYSxFQUFFLFdBQVcsTUFBTSxPQUFPLE1BQU0saUJBQWlCLFVBQVU7QUFBQTtBQUFBLE1BRTFFO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFFBQVE7QUFBQSxFQUNwQjtBQUFBLEVBQ0EsT0FBTyxFQUFFLFFBQVEsVUFBVSxlQUFlLE9BQU8sY0FBYyxLQUFLO0FBQUEsRUFDcEUsUUFBUSxFQUFFLFFBQVEsYUFBYTtBQUFBLEVBQy9CLFFBQVEsRUFBRSxNQUFNLE1BQU0sTUFBTSxLQUFLO0FBQ25DLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
