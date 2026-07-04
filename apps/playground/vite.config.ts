import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { lathaStart } from '@latha/start/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // lathaStart() wraps tanstackStart() and injects the framework's /login and
    // /admin/$ routes, so this app needs no route files for them. In the
    // monorepo it also serves @latha/* packages from source for instant HMR;
    // that is a no-op for apps that install @latha/start from npm.
    lathaStart(),
    // Deploy-target plugin. TanStack Start no longer bundles its own deploy
    // adapters — Nitro auto-detects the host (Vercel, Netlify, Cloudflare,
    // plain Node) from the build environment, so no explicit preset is
    // needed here. Also what makes `pnpm start` (`.output/server/index.mjs`)
    // work at all: without this plugin the build only emits a plain Vite SSR
    // bundle under `dist/`, not the `.output/` tree that script expects.
    nitro(),
    viteReact(),
  ],
})
