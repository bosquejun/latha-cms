#!/usr/bin/env node
/**
 * kon10 — the Kon10 developer CLI.
 *
 *   kon10 typegen --url https://cms.example.com --out kon10.gen.ts
 *   kon10 typegen --manifest ./manifest.json --out src/kon10.gen.ts
 *
 * `typegen` reads a Studio's delivery manifest (`GET /api/v1/_manifest`) — from
 * a running instance (`--url`) or a saved JSON file (`--manifest`) — and writes
 * per-entity Zod schemas + inferred types. Pipe those into the delivery
 * client's per-call `schema` option for typed, validated reads.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { generateTypes } from './typegen.js'
import { fetchManifest, parseManifest, type Manifest } from './manifest.js'

const USAGE = `kon10 — Kon10 developer CLI

Usage:
  kon10 typegen [options]

typegen options:
  --url <baseUrl>       Origin hosting the delivery API (fetches /api/v1/_manifest)
  --manifest <file>     Read the manifest from a saved JSON file instead of --url
  --api-key <key>       API key for the manifest fetch (or KON10_API_KEY env)
  --base-path <path>    Delivery API base path (default: /api/v1)
  --out <file>          Output file (default: kon10.gen.ts)
  -h, --help            Show this help
`

async function runTypegen(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: 'string' },
      manifest: { type: 'string' },
      'api-key': { type: 'string' },
      'base-path': { type: 'string' },
      out: { type: 'string', default: 'kon10.gen.ts' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    process.stdout.write(USAGE)
    return 0
  }

  let manifest: Manifest
  let source: string
  if (values.manifest) {
    manifest = parseManifest(await readFile(values.manifest, 'utf8'))
    source = values.manifest
  } else if (values.url) {
    manifest = await fetchManifest({
      url: values.url,
      apiKey: values['api-key'] ?? process.env.KON10_API_KEY,
      basePath: values['base-path'],
    })
    source = values.url
  } else {
    process.stderr.write('error: provide --url <baseUrl> or --manifest <file>.\n\n' + USAGE)
    return 1
  }

  const out = values.out as string
  await writeFile(out, generateTypes(manifest, { source }), 'utf8')
  process.stdout.write(`Wrote ${manifest.entities.length} entities to ${out}\n`)
  return 0
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2)
  switch (command) {
    case 'typegen':
      return runTypegen(rest)
    case undefined:
    case '-h':
    case '--help':
      process.stdout.write(USAGE)
      return command === undefined ? 1 : 0
    default:
      process.stderr.write(`error: unknown command "${command}".\n\n${USAGE}`)
      return 1
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  },
)
