#!/usr/bin/env node
// Guard: refuse `major` bumps in changesets.
//
// Kon10 is staying on the 1.x line for now — releases should be `minor` or
// `patch` only. There is no native Changesets option to cap the bump level, so
// this script scans every `.changeset/*.md` and fails if any package is marked
// `major`. Wired into CI so a stray major can't quietly ship a 2.0.0.
//
// Remove this guard (and its CI step) when a major release is intentionally on
// the table.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const changesetDir = join(dirname(fileURLToPath(import.meta.url)), '..', '.changeset')

const files = readdirSync(changesetDir).filter(
  (f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md',
)

const offenders = []

for (const file of files) {
  const contents = readFileSync(join(changesetDir, file), 'utf8')
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) continue

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    // Frontmatter lines look like: '@kon10/core': major
    const bump = line.split(':').pop()?.trim().replace(/^['"]|['"]$/g, '')
    if (bump === 'major') {
      offenders.push(`${file}: ${line}`)
    }
  }
}

if (offenders.length > 0) {
  console.error('✖ Major-version changesets are not allowed right now.')
  console.error('  Kon10 is staying on the 1.x line — use `minor` or `patch`.\n')
  for (const offender of offenders) {
    console.error(`  ${offender}`)
  }
  console.error('\n  Edit the changeset(s) above to a `minor` or `patch` bump.')
  process.exit(1)
}

console.log(`✔ No major changesets found (${files.length} checked).`)
