import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import devServer from '@hono/vite-dev-server'

export default defineConfig({
  plugins: [
    tailwindcss(),
    devServer({ entry: './src/index.tsx' })
  ]
})
