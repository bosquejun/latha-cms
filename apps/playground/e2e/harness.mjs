/**
 * Browser + auth helpers shared by the E2E test files.
 *
 * Uses `playwright-core` with the pre-installed Chromium (per the `verify`
 * skill): `executablePath` points at `/opt/pw-browsers/chromium` when present,
 * and falls back to playwright-core's own resolution in CI (where the browser
 * is provisioned by `playwright install`).
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

/** Resolve the Chromium binary across the dev sandbox and CI. */
export function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH
  const preinstalled = '/opt/pw-browsers/chromium'
  if (existsSync(preinstalled)) return preinstalled
  return undefined // CI: let playwright-core find the `playwright install`ed browser
}

export function launchBrowser() {
  return chromium.launch({ headless: true, executablePath: resolveChromium() })
}

export const ADMIN = { email: 'admin@kon10.dev', password: 'password' }

/**
 * A link by accessible name, filtered to the visible one. Nav/list links are
 * duplicated in the DOM (hidden MobileMenu + visible rail/rows), so an
 * unfiltered `.first()` can resolve the hidden copy (see the `verify` skill).
 */
export function visibleLink(page, name) {
  return page.getByRole('link', { name }).filter({ visible: true })
}

/**
 * Log in via the real `/login` page and land on the Studio. Loading a
 * `/studio/*` route unauthenticated only renders a client-side "Redirecting…"
 * splash, so every flow must authenticate here first.
 */
export async function login(page, baseURL, user = ADMIN) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' })
  const email = page.locator('input[type="email"]')
  await email.waitFor({ state: 'visible' })
  await email.fill(user.email)
  await page.locator('input[type="password"]').fill(user.password)

  // The submit handler attaches on hydration, which can land just after the
  // button is clickable — retry the click until the app actually navigates.
  const submit = page.locator('button[type="submit"]')
  for (let attempt = 0; attempt < 4; attempt++) {
    await submit.click()
    try {
      await page.waitForURL('**/studio**', { timeout: 15_000 })
      return
    } catch {
      if (attempt === 3) throw new Error('login did not navigate to /studio')
    }
  }
}
