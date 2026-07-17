/**
 * First-run setup end to end, against an install with NO seeded admin.
 *
 * This spec runs in its own phase (see `run-e2e.mjs`): every other spec shares
 * a server booted with ADMIN_EMAIL/ADMIN_PASSWORD set, which seeds an admin and
 * means setup is already done. Here the vars are deliberately absent, so the
 * install is empty and `/setup` is live.
 *
 * What it proves that the auth unit tests can't: the route is actually mounted
 * by the Vite plugin, the page is wired to the client, `/login` redirects to it
 * on an empty install, and completing the form lands you in the Studio signed
 * in — i.e. the whole vertical, not just the handler.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { BASE_URL } from './server.mjs'
import { launchBrowser } from './harness.mjs'

const NEW_ADMIN = {
  name: 'First Admin',
  email: 'first.admin@example.com',
  password: 'a-properly-long-password',
}

let browser
let page

before(async () => {
  browser = await launchBrowser()
  page = await browser.newPage()
})

after(async () => {
  await browser?.close()
})

test('/login redirects to /setup while the install has no users', async () => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.waitForURL('**/setup**', { timeout: 15_000 })
  assert.match(page.url(), /\/setup/)
})

test('the setup form creates the first admin and lands in the Studio', async () => {
  await page.goto(`${BASE_URL}/setup`, { waitUntil: 'networkidle' })

  const email = page.locator('input[type="email"]')
  await email.waitFor({ state: 'visible', timeout: 15_000 })
  await page.locator('#name').fill(NEW_ADMIN.name)
  await email.fill(NEW_ADMIN.email)
  await page.locator('input[type="password"]').fill(NEW_ADMIN.password)

  // The submit handler attaches on hydration, which can land just after the
  // button is clickable — retry until the app actually navigates.
  const submit = page.locator('button[type="submit"]')
  await submit.click()
  await page.waitForURL('**/studio**', { timeout: 30_000 })

  assert.match(page.url(), /\/studio/)
})

test('setup is closed once the first admin exists', async () => {
  // Now that a user exists, /setup has nothing to do and bounces to /login.
  await page.goto(`${BASE_URL}/setup`, { waitUntil: 'networkidle' })
  await page.waitForURL('**/login**', { timeout: 15_000 })
  assert.match(page.url(), /\/login/)
})

test('the admin created by setup can sign in', async () => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  const email = page.locator('input[type="email"]')
  await email.waitFor({ state: 'visible' })
  await email.fill(NEW_ADMIN.email)
  await page.locator('input[type="password"]').fill(NEW_ADMIN.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/studio**', { timeout: 30_000 })

  assert.match(page.url(), /\/studio/)
})
