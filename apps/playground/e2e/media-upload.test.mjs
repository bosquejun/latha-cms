/**
 * Media upload end to end: uploading a file through a `media` field runs the
 * real upload route + `localDiskStorage`, and the field renders the stored
 * asset back from `/uploads/…`. Then the post saves with the media reference.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { BASE_URL } from './server.mjs'
import { launchBrowser, login, visibleLink } from './harness.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixtures', 'pixel.png')

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

test('uploading to a media field stores the asset and previews it', async () => {
  await page.goto(`${BASE_URL}/studio/content/posts/new`, { waitUntil: 'networkidle' })

  // The media field's dropzone wraps a hidden file input.
  await page.locator('input[type="file"]').first().setInputFiles(fixture)

  // On a successful upload the field previews the stored asset from /uploads/.
  const preview = page.locator('img[src*="/uploads/"]')
  await preview.first().waitFor({ state: 'visible', timeout: 20_000 })
  const src = await preview.first().getAttribute('src')
  assert.match(src ?? '', /\/uploads\/.*pixel\.png$/)
})

test('a post saves with an uploaded featured image', async () => {
  const title = `E2E Media ${Date.now()}`
  await page.goto(`${BASE_URL}/studio/content/posts/new`, { waitUntil: 'networkidle' })
  await page.getByLabel(/^Title/).first().fill(title)
  await page.locator('input[type="file"]').first().setInputFiles(fixture)
  await page.locator('img[src*="/uploads/"]').first().waitFor({ state: 'visible', timeout: 20_000 })

  await page.getByRole('button', { name: 'Create Post' }).click()
  await page.waitForURL('**/studio/content/posts', { timeout: 20_000 })
  await visibleLink(page, title).first().waitFor({ state: 'visible', timeout: 10_000 })

  // Reopen and confirm the media reference survived the round-trip.
  await visibleLink(page, title).first().click()
  await page.waitForURL(/\/studio\/content\/posts\/(?!new$)[^/]+$/, { timeout: 20_000 })
  await page.locator('img[src*="/uploads/"]').first().waitFor({ state: 'visible', timeout: 15_000 })
})
