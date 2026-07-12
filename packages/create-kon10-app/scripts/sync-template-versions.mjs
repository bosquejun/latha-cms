/**
 * Rewrite the template's `@kon10/*` deps from the committed `latest`
 * placeholder to `^<version>` of each workspace package. Wired as `prepack`
 * so a publish always ships pinned versions; the committed template stays
 * valid (`latest`) even if the hook is skipped. No-ops when the monorepo
 * root can't be found (published-package safety).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = join(pkgRoot, '..', '..')

if (!existsSync(join(workspaceRoot, 'pnpm-workspace.yaml'))) {
  console.log('[sync-template-versions] no workspace root found; skipping.')
  process.exit(0)
}

/** name → version for every @kon10/* workspace package. */
const versions = new Map()
for (const group of ['packages', 'packages/modules', 'packages/plugins']) {
  const groupDir = join(workspaceRoot, group)
  if (!existsSync(groupDir)) continue
  for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(groupDir, entry.name, 'package.json')
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.name?.startsWith('@kon10/') && manifest.version) {
      versions.set(manifest.name, manifest.version)
    }
  }
}

const templateManifestPath = join(pkgRoot, 'template', 'package.json')
const template = JSON.parse(readFileSync(templateManifestPath, 'utf8'))

let rewritten = 0
for (const section of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(template[section] ?? {})) {
    const version = versions.get(name)
    if (version) {
      template[section][name] = `^${version}`
      rewritten++
    }
  }
}

writeFileSync(templateManifestPath, JSON.stringify(template, null, 2) + '\n')
console.log(`[sync-template-versions] pinned ${rewritten} @kon10/* deps.`)
