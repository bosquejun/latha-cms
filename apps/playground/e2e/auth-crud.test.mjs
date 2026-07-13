/**
 * Core Studio flows against the live playground: real login, list rendering,
 * and full create → edit → save round-trips for a collection (`posts`) and a
 * singleton (`site-settings`). Drives the actual browser UI end to end.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE_URL } from './server.mjs'
import { launchBrowser, login, visibleLink } from './harness.mjs'

let browser
let page
const stamp = Date.now()

before(async () => {
  browser = await launchBrowser()
  page = await browser.newPage()
  await login(page, BASE_URL)
})

after(async () => {
  await browser?.close()
})

test('login lands on the Studio dashboard', () => {
  assert.match(page.url(), /\/studio(\/|$)/)
})

test('the posts list renders with a create affordance', async () => {
  await page.goto(`${BASE_URL}/studio/content/posts`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Posts' }).first().waitFor({ state: 'visible' })
  assert.ok(await page.getByRole('link', { name: 'New' }).count() > 0)
})

test('creating a post persists it to the list', async () => {
  const title = `E2E Created ${stamp}`
  await page.goto(`${BASE_URL}/studio/content/posts/new`, { waitUntil: 'networkidle' })
  await page.getByLabel(/^Title/).first().fill(title)
  await page.getByRole('button', { name: 'Create Post' }).click()

  // The app redirects to the list on success.
  await page.waitForURL('**/studio/content/posts', { timeout: 20_000 })
  await visibleLink(page, title).first().waitFor({ state: 'visible', timeout: 10_000 })
})

test('editing a post saves the new title', async () => {
  const title = `E2E Editable ${stamp}`
  const edited = `${title} — edited`

  // Create it first.
  await page.goto(`${BASE_URL}/studio/content/posts/new`, { waitUntil: 'networkidle' })
  await page.getByLabel(/^Title/).first().fill(title)
  await page.getByRole('button', { name: 'Create Post' }).click()
  await page.waitForURL('**/studio/content/posts', { timeout: 20_000 })

  // Open its edit form.
  await visibleLink(page, title).first().click()
  await page.waitForURL(/\/studio\/content\/posts\/(?!new$)[^/]+$/, { timeout: 20_000 })

  const titleField = page.getByLabel(/^Title/).first()
  await titleField.fill(edited)
  await page.getByRole('button', { name: /save/i }).click()

  // Saving returns to the list (same as create); the row now shows the new
  // title — proof the edit persisted.
  await page.goto(`${BASE_URL}/studio/content/posts`, { waitUntil: 'networkidle' })
  await visibleLink(page, edited).first().waitFor({ state: 'visible', timeout: 10_000 })
})

test('a singleton (site-settings) saves and persists', async () => {
  const value = `Kon10 E2E ${stamp}`
  await page.goto(`${BASE_URL}/studio/documents/site-settings`, { waitUntil: 'networkidle' })

  const field = page.getByLabel(/^Site Name/).first()
  await field.waitFor({ state: 'visible' })
  await field.fill(value)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(1500)

  await page.reload({ waitUntil: 'networkidle' })
  assert.equal(await page.getByLabel(/^Site Name/).first().inputValue(), value)
})
