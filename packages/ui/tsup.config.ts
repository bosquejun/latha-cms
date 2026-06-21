import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Resolve the `@/*` alias used by shadcn-generated components.
  esbuildOptions(options) {
    options.alias = { '@': new URL('./src', import.meta.url).pathname }
  },
  external: ['react', 'react-dom'],
})
