import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { kon10Start } from '@kon10/start/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig(({ command }) => ({
  // @libsql/client dynamically requires a platform-specific native binding
  // Rollup can't statically analyze, so it must stay un-bundled.
  ssr: {
    external: ['@libsql/client'],
  },
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // kon10Start() wraps tanstackStart() and injects the framework's /login
    // and /studio/$ routes — this app ships no route files for them.
    kon10Start({ configPath: './kon10.config.ts' }),
    // Nitro produces the deployable .output tree; build-only because its dev
    // environment setup conflicts with @kon10/start's Studio-UI config loader.
    command === 'build' &&
      nitro({
        rollupConfig: { external: ['@libsql/client'] },
      }),
    viteReact(),
  ],
}))
