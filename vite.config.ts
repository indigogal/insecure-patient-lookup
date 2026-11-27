import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import devServer from '@hono/vite-dev-server'
import { readFileSync } from 'node:fs'

export default defineConfig({
  server: {
    port: 8080,
    strictPort: true,
    https: {
      key: readFileSync("./certs/localhost.key"),
      cert: readFileSync("./certs/localhost.crt"),
    },
  },
  plugins: [
    tailwindcss(),
    devServer({ entry: './src/index.tsx' })
  ]
})
