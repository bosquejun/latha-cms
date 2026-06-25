import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { lathaStart } from '@latha/start/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    // lathaStart() wraps tanstackStart() and injects the framework's /login and
    // /admin/$ routes, so this app needs no route files for them. In the
    // monorepo it also serves @latha/* packages from source for instant HMR;
    // that is a no-op for apps that install @latha/start from npm.
    lathaStart(),
    viteReact(),
  ],
})
