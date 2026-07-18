/**
 * The pure scaffolding step, split from the CLI entry so it's testable with
 * plain `node:test`: copy the template, rename `gitignore` → `.gitignore`
 * (npm mangles dotfiles inside published packages, so the template can't
 * ship one), stamp the project name into `package.json`, and generate a
 * `.env` with a fresh `AUTH_SECRET` (secrets are generated, never templated).
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Unscoped npm package name rules — also the target directory name. */
const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export function validateProjectName(name: string): string | null {
  if (name.length === 0) return 'Project name is empty.'
  if (name.length > 214) return 'Project name is too long (max 214 characters).'
  if (!NAME_PATTERN.test(name)) {
    return 'Project name must be lowercase letters, digits, ".", "_" or "-", and start with a letter or digit.'
  }
  return null
}

export interface ScaffoldOptions {
  /** Directory to create the project in (must not exist, or be empty). */
  targetDir: string
  /** The project name stamped into `package.json`. */
  projectName: string
  /** The shipped `template/` directory to copy. */
  templateDir: string
}

export function scaffold({ targetDir, projectName, templateDir }: ScaffoldOptions): void {
  const nameError = validateProjectName(projectName)
  if (nameError) throw new Error(nameError)

  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory "${targetDir}" already exists and is not empty.`)
  }

  cpSync(templateDir, targetDir, { recursive: true })
  renameSync(join(targetDir, 'gitignore'), join(targetDir, '.gitignore'))

  const pkgPath = join(targetDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
  pkg['name'] = projectName
  pkg['kon10'] = { projectId: randomUUID() }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  // 32 random bytes satisfies the production requirement enforced by
  // @kon10/start's runtime (`AUTH_SECRET`, 32+ bytes).
  const authSecret = randomBytes(32).toString('base64url')
  writeFileSync(
    join(targetDir, '.env'),
    [
      '# Session-token signing secret. Required in production; keep it out of git.',
      `AUTH_SECRET=${authSecret}`,
      '',
      '# Database — defaults to a local SQLite file. Point at Turso in production:',
      '# TURSO_DATABASE_URL=libsql://…',
      '# TURSO_AUTH_TOKEN=…',
      '',
      '# First-run admin seed (defaults: admin@kon10.dev / password):',
      '# ADMIN_EMAIL=you@example.com',
      '# ADMIN_PASSWORD=change-me',
      '',
    ].join('\n'),
  )
}
