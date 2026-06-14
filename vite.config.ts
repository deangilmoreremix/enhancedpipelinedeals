import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";
import fs from 'fs';
import path from 'path';

function fixFederationCssForVite8() {
  return {
    name: 'fix-federation-css-for-vite8',
    enforce: 'post',
    closeBundle: async () => {
      try {
        const outDir = 'dist';
        const assetsDir = path.join(outDir, 'assets');
        if (!fs.existsSync(assetsDir)) return;

        const files = fs.readdirSync(assetsDir);
        const cssFiles = files.filter(f => f.endsWith('.css'));
        if (cssFiles.length === 0) return;

        const remoteCandidates = [path.join(outDir, 'remoteEntry.js'), path.join(assetsDir, 'remoteEntry.js')];
        let remotePath = remoteCandidates.find(p => fs.existsSync(p));
        if (!remotePath) {
          const possible = files.find(f => f.includes('remoteEntry') && f.endsWith('.js'));
          if (possible) remotePath = path.join(assetsDir, possible);
        }
        if (!remotePath) return;

        const cssList = cssFiles.map(f => f);
        const injection = `\n;(function(){try{var _script=document.currentScript||document.querySelector('script[src*="remoteEntry"]');var _base=_script?new URL('.',_script.src).href:document.baseURI;var _css=${JSON.stringify(cssList)};_css.forEach(function(name){var href=_base+('assets/'+name);if(!document.querySelector('link[href="'+href+'"]')){var l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);}});}catch(e){console.warn('fix-federation-css-for-vite8 injection failed',e);} })();\n`;

        const remoteContent = fs.readFileSync(remotePath, 'utf8');
        if (!remoteContent.includes('fix-federation-css-for-vite8')) {
          fs.writeFileSync(remotePath, remoteContent + injection, 'utf8');
          console.log('[fix-federation-css-for-vite8] Injected CSS loader into', remotePath);
        }
      } catch (err) {
        console.warn('[fix-federation-css-for-vite8] failed', err);
      }
    }
  };
}

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
    fixFederationCssForVite8()
  ],
  optimizeDeps: {
    exclude: ['openai'],
    include: ['@supabase/supabase-js', 'lucide-react']
  },
  build: {
    target: "esnext",
    modulePreload: false,
    cssCodeSplit: false,
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['lucide-react', 'recharts'],
          ai: ['openai']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false
  },
  define: {
    global: "globalThis",
    'process.env': 'import.meta.env',
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  server: {
    host: true,
    port: 5176,
    cors: true
  },
  preview: {
    port: 4173,
    host: true,
    cors: true
  },
  envPrefix: ['VITE_', 'SUPABASE_']
}));
