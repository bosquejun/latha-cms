/**
 * Studio extensions render end to end — the four auto-discovered extension
 * kinds under `apps/playground/src/studio/`: a dashboard widget, a custom page
 * (with its own nav tab), an entity-scoped form-sidebar widget, and a topbar
 * widget. Proves the `kon10Start()` auto-collection + zone rendering works in
 * the real shell.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE_URL } from './server.mjs'
import { launchBrowser, login } from './harness.mjs'

let browser
let page

before(async () => {
  browser = await launchBrowser()
  page = await browser.newPage()
  await login(page, BASE_URL)
})

after(async () => {
  await browser?.close()
})

test('the custom dashboard widget renders on the dashboard', async () => {
  await page.goto(`${BASE_URL}/studio`, { waitUntil: 'networkidle' })
  await page.getByText('Welcome to your Studio').waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByText('This card is a custom dashboard widget.').waitFor({ state: 'visible' })
})

test('the topbar widget renders in the shell', async () => {
  await page.getByRole('link', { name: 'Help' }).first().waitFor({ state: 'visible', timeout: 10_000 })
})

test('the custom page mounts at its route with a nav tab', async () => {
  // Nav tab is present in the shell.
  assert.ok(await page.getByRole('link', { name: 'Analytics' }).count() > 0)

  await page.goto(`${BASE_URL}/studio/analytics`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Analytics' }).first().waitFor({ state: 'visible', timeout: 15_000 })
  await page.getByText('A custom page mounted at /studio/analytics.').waitFor({ state: 'visible' })
})

test('the entity-scoped form widget renders on the posts create form', async () => {
  await page.goto(`${BASE_URL}/studio/content/posts/new`, { waitUntil: 'networkidle' })
  await page.getByText('Writing tips').waitFor({ state: 'visible', timeout: 15_000 })
})
