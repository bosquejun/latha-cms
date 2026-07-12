#!/usr/bin/env node
/**
 * create-kon10-app — scaffold a new Kon10 app.
 *
 *   pnpm create kon10-app my-app
 *   npm create kon10-app my-app
 *
 * Zero runtime dependencies: prompts via node:readline, colors via raw ANSI.
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import { scaffold, validateProjectName } from './scaffold.js'

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`

const DEFAULT_NAME = 'my-kon10-app'

/** `pnpm create` / `npm create` / `yarn create` set this — used only for the next-steps text. */
function detectPackageManager(): 'pnpm' | 'yarn' | 'bun' | 'npm' {
  const agent = process.env['npm_config_user_agent'] ?? ''
  if (agent.startsWith('pnpm')) return 'pnpm'
  if (agent.startsWith('yarn')) return 'yarn'
  if (agent.startsWith('bun')) return 'bun'
  return 'npm'
}

async function main(): Promise<void> {
  let projectName = process.argv[2]

  if (!projectName) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = await rl.question(`${bold('Project name')} (${DEFAULT_NAME}): `)
    rl.close()
    projectName = answer.trim() || DEFAULT_NAME
  }

  const nameError = validateProjectName(projectName)
  if (nameError) {
    console.error(`${red('✖')} ${nameError}`)
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), projectName)
  const templateDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'template')
  if (!existsSync(templateDir)) {
    console.error(`${red('✖')} Template directory not found at ${templateDir}.`)
    process.exit(1)
  }

  try {
    scaffold({ targetDir, projectName, templateDir })
  } catch (err) {
    console.error(`${red('✖')} ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const pm = detectPackageManager()
  console.log(`
${green('✔')} Scaffolded ${bold(projectName)}.

Next steps:

  ${cyan(`cd ${projectName}`)}
  ${cyan(`${pm} install`)}
  ${cyan(pm === 'npm' ? 'npm run dev' : `${pm} dev`)}

Then open ${bold('http://localhost:3000/studio')} and sign in with the seeded
admin — ${bold('admin@kon10.dev / password')} — and change that password.
A fresh AUTH_SECRET was written to ${bold('.env')}; keep it out of git.
`)
}

void main()
