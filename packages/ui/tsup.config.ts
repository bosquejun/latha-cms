import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Resolve the `@/*` alias used by shadcn-generated components.
  esbuildOptions(options) {
    options.alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  external: ['react', 'react-dom'],
})
