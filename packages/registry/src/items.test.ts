/**
 * Item source files are template code shipped verbatim to consumers — they are
 * intentionally excluded from this package's `tsc` build (they import from the
 * consumer's project, e.g. `@/lib/kon10`). This guard still catches the failure
 * mode we can check without the consumer's context: a syntax error. Each file
 * is run through `ts.transpileModule`, which reports syntactic diagnostics
 * without resolving cross-file imports.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const itemsRoot = fileURLToPath(new URL('../items', import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

test('every registry item source file is syntactically valid', () => {
  const files = walk(itemsRoot)
  assert.ok(files.length > 0, 'expected at least one item source file')
  for (const file of files) {
    const out = ts.transpileModule(readFileSync(file, 'utf8'), {
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    const errors = (out.diagnostics ?? []).filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    )
    assert.equal(
      errors.length,
      0,
      `${file}: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}`,
    )
  }
})
