import { fileURLToPath, URL } from 'node:url'
import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  appType: 'mpa',
  build: {
    target: 'esnext',
  },
  plugins: [
    vue(),
    vueDevTools(),
    tailwindcss(),
    {
      name: 'serve-onnx-wasm',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/wasm/ort-wasm-simd-threaded.jsep.mjs?import') {
            const filePath = path.resolve(__dirname, 'public/wasm/ort-wasm-simd-threaded.jsep.mjs')
            fs.readFile(filePath, (err, data) => {
              if (err) {
                res.statusCode = 404
                res.end('File not found')
              } else {
                res.setHeader('Content-Type', 'application/javascript')
                res.end(data)
              }
            })
          } else if (req.url === '/transformers.js?import') {
            const filePath = path.resolve(__dirname, 'public/transformers.js')
            fs.readFile(filePath, (err, data) => {
              if (err) {
                res.statusCode = 404
                res.end('File not found')
              } else {
                res.setHeader('Content-Type', 'application/javascript')
                res.end(data)
              }
            })
          } else {
            next()
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
})
