import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync } from 'node:fs';

// https://vitejs.dev/config/
export default defineConfig({
  define: { 'import.meta.env.VITE_NATIVE_PUSH_CONFIGURED': JSON.stringify(String(existsSync(path.resolve(__dirname, 'android/app/google-services.json')))) },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          webllm: ['@mlc-ai/web-llm'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
