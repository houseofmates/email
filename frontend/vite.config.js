// defineConfig from vitest/config extends vite's config with the `test` field
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3099",
        changeOrigin: true,
      },
      "/jmap": {
        target: "http://localhost:3099",
        changeOrigin: true,
      },
      "/identity": {
        target: "http://localhost:3099",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  // vitest config — jsdom env so future component tests (RTL) work out of the
  // box; pure helpers like the generator run fine here too.
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
})