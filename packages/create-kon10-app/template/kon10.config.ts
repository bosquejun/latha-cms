/**
 * kon10.config.ts — the single entrypoint of a Kon10 app.
 *
 * Everything else (the API, auth, the Studio UI at /studio) is derived from
 * this file by @kon10/start. Add fields, collections, and modules here.
 */

import { defineConfig } from '@kon10/core'
import { AuthModule, getRoleByName, hashPassword } from '@kon10/auth'
import { CacheModule, inMemoryCache } from '@kon10/cache'
import { Collection, ContentModule, Document, date, richtext, text } from '@kon10/content'
import { tursoAdapter } from '@kon10/storage'
import { telemetryPlugin } from '@kon10/telemetry'
import { countUsers, createUser, UsersModule } from '@kon10/users'

export default defineConfig({
  // Local SQLite file by default; point at Turso in production via env vars.
  db: tursoAdapter({
    url: process.env.TURSO_DATABASE_URL ?? 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),

  // Anonymous, opt-out usage telemetry (à la Medusa). Inert until you set a
  // PostHog key (`KON10_TELEMETRY_POSTHOG_KEY`); then it's on by default. Opt
  // out with `KON10_DISABLE_TELEMETRY=1` or the cross-tool `DO_NOT_TRACK=1`.
  plugins: [telemetryPlugin()],

  // Studio branding — shown on the login screen and in the Studio shell. Drop a
  // logo in `public/` and set `logo: '/logo.svg'` to replace the default mark.
  studio: {
    branding: {
      appName: 'Kon10',
      tagline: 'Everything you publish, in one place.',
      taglineSubtitle: 'Model content, manage media, and ship a fast delivery API.',
    },
    // One-time disclosure shown in the Studio on first sign-in, pairing with the
    // opt-out telemetry above. `mode: 'opt-in'` turns it into an Allow/No-thanks
    // consent prompt instead. Remove it (or the telemetry plugin) if you don't
    // collect telemetry.
    telemetryNotice: {
      enabled: true,
      mode: 'notice',
      message:
        'We collect usage data to help make this app better. We never see the ' +
        'content you manage. To turn it off, set KON10_DISABLE_TELEMETRY=1.',
      // policyUrl: 'https://your-site.com/privacy',
    },
  },

  modules: [
    UsersModule(),
    // AUTH_SECRET is required in production (the runtime refuses to boot
    // without it) — `create-kon10-app` generated one in `.env`.
    AuthModule({ secret: process.env.AUTH_SECRET ?? 'kon10-dev-secret-change-me' }),
    CacheModule({ cache: inMemoryCache() }),

    ContentModule({
      entities: [
        Collection({
          slug: 'posts',
          studio: { useAsTitle: 'title' },
          fields: {
            title: text({ required: true }),
            body: richtext(),
            publishedAt: date({ meta: { sidebar: true } }),
          },
        }),
        Document({
          slug: 'site-settings',
          fields: {
            siteTitle: text({ required: true, meta: { label: 'Site Title' } }),
            description: text({ meta: { multiline: true } }),
          },
        }),
      ],
    }),
  ],

  // First-run seed so login works out of the box. Override the defaults with
  // ADMIN_EMAIL / ADMIN_PASSWORD — and change the password immediately in
  // production.
  seed: async (kon10) => {
    if ((await countUsers(kon10)) === 0) {
      const adminRole = await getRoleByName(kon10, 'admin')
      await createUser(kon10, {
        email: process.env.ADMIN_EMAIL ?? 'admin@kon10.dev',
        name: 'Admin',
        roles: adminRole ? [adminRole.id] : [],
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD ?? 'password'),
      })
      kon10.logger.info('seeded first admin user — sign in at /studio and change the password')
    }
  },
})
