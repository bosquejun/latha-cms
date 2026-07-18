import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { scaffold, validateProjectName } from './scaffold.js'

// The real shipped template, relative to dist/ at test time.
const templateDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'template')

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'create-kon10-app-test-'))
}

test('scaffold copies the template, renames gitignore, stamps the name, writes .env', () => {
  const parent = freshDir()
  try {
    const target = join(parent, 'demo-app')
    scaffold({ targetDir: target, projectName: 'demo-app', templateDir })

    for (const f of [
      'package.json',
      'kon10.config.ts',
      'vite.config.ts',
      'tsconfig.json',
      'README.md',
      '.gitignore',
      '.env',
      'src/router.tsx',
      'src/styles.css',
      'src/routes/__root.tsx',
      'src/routes/index.tsx',
      'src/studio/settings/telemetry.tsx',
    ]) {
      assert.ok(existsSync(join(target, f)), `missing ${f}`)
    }
    // The un-dotted template source name must not survive the copy.
    assert.equal(existsSync(join(target, 'gitignore')), false)

    const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8')) as {
      name: string
      dependencies: Record<string, string>
      kon10: { projectId: string }
    }
    assert.equal(pkg.name, 'demo-app')
    assert.match(
      pkg.kon10.projectId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    assert.ok(pkg.dependencies['@kon10/start'])
    assert.ok(pkg.dependencies['@kon10/telemetry'])

    const config = readFileSync(join(target, 'kon10.config.ts'), 'utf8')
    assert.match(config, /mode:\s*'opt-out'/)
    assert.match(config, /manageUrl:\s*'\/studio\/settings\/telemetry'/)

    const env = readFileSync(join(target, '.env'), 'utf8')
    const secret = /^AUTH_SECRET=(.+)$/m.exec(env)?.[1]
    assert.ok(secret, '.env has an AUTH_SECRET line')
    // 32 random bytes → 43 base64url chars: satisfies the 32+-byte production rule.
    assert.ok(secret.length >= 43)
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('scaffold generates a distinct AUTH_SECRET per project', () => {
  const parent = freshDir()
  try {
    scaffold({ targetDir: join(parent, 'a'), projectName: 'a', templateDir })
    scaffold({ targetDir: join(parent, 'b'), projectName: 'b', templateDir })
    const secretOf = (dir: string) =>
      /^AUTH_SECRET=(.+)$/m.exec(readFileSync(join(parent, dir, '.env'), 'utf8'))?.[1]
    assert.notEqual(secretOf('a'), secretOf('b'))
    const projectIdOf = (dir: string) =>
      (
        JSON.parse(readFileSync(join(parent, dir, 'package.json'), 'utf8')) as {
          kon10: { projectId: string }
        }
      ).kon10.projectId
    assert.notEqual(projectIdOf('a'), projectIdOf('b'))
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('scaffold refuses a non-empty target directory', () => {
  const parent = freshDir()
  try {
    const target = join(parent, 'taken')
    mkdirSync(target)
    writeFileSync(join(target, 'keep.txt'), 'do not clobber')
    assert.throws(
      () => scaffold({ targetDir: target, projectName: 'taken', templateDir }),
      /not empty/,
    )
    assert.equal(readFileSync(join(target, 'keep.txt'), 'utf8'), 'do not clobber')
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

test('validateProjectName enforces npm name rules', () => {
  assert.equal(validateProjectName('my-app'), null)
  assert.equal(validateProjectName('app2.site'), null)
  assert.notEqual(validateProjectName(''), null)
  assert.notEqual(validateProjectName('My-App'), null)
  assert.notEqual(validateProjectName('-leading-dash'), null)
  assert.notEqual(validateProjectName('has space'), null)
  assert.notEqual(validateProjectName('@scope/app'), null)
  assert.notEqual(validateProjectName('a'.repeat(215)), null)
})
