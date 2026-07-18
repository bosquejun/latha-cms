/**
 * telemetryPlugin — anonymous, opt-out usage analytics for Kon10, à la Medusa.
 *
 * When a PostHog key is available (option or `KON10_TELEMETRY_POSTHOG_KEY`) and
 * telemetry isn't disabled, it registers a PostHog sink on the instance, logs a
 * one-time disclosure, and captures a technical `kon10_boot` event. Product
 * events (e.g. Studio actions) flow through `cms.telemetry` from the runner.
 *
 * It is **opt-out**: enabled by default, suppressed by `KON10_DISABLE_TELEMETRY`,
 * the cross-tool `DO_NOT_TRACK`, CI, tests, or `enabled: false`. With no key it
 * is inert (nothing is sent). Only anonymous, non-identifying data is collected
 * — never content, credentials, or PII.
 */

import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { z } from '@kon10/core'
import type { Kon10Instance, Plugin } from '@kon10/core'
import { isTelemetryDisabled } from './env.js'
import { loadTelemetryStore, markNotified, readProjectTelemetryId } from './instance-id.js'
import { createPosthogTelemetry } from './posthog.js'

/** This plugin's own version, sent as a technical property (not the kernel's). */
const TELEMETRY_VERSION = '1.0.0'
const DEFAULT_HOST = 'https://us.i.posthog.com'

/** Resolve the installed peer's version without requiring package.json to be exported. */
function readKon10Version(): string {
  try {
    let directory = path.dirname(createRequire(import.meta.url).resolve('@kon10/core'))
    for (let depth = 0; depth < 4; depth++) {
      const manifestPath = path.join(directory, 'package.json')
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
          name?: unknown
          version?: unknown
        }
        if (manifest.name === '@kon10/core' && typeof manifest.version === 'string') {
          return manifest.version
        }
      }
      directory = path.dirname(directory)
    }
  } catch {
    // Bundled or otherwise non-standard package layout.
  }
  return 'unknown'
}

function isContainer(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.KUBERNETES_SERVICE_HOST || env.CONTAINER) || fs.existsSync('/.dockerenv')
}

export const telemetryPluginOptionsSchema = z.object({
  /** Force-disable regardless of environment. Default: opt-out via env. */
  enabled: z.boolean().optional(),
  posthog: z
    .object({
      /** PostHog project API key. Falls back to `KON10_TELEMETRY_POSTHOG_KEY`. */
      key: z.string().optional(),
      /** PostHog host. Falls back to `KON10_TELEMETRY_POSTHOG_HOST`, then PostHog US cloud. */
      host: z.string().optional(),
    })
    .optional(),
})

export type TelemetryPluginOptions = z.infer<typeof telemetryPluginOptionsSchema>

export function telemetryPlugin(options: TelemetryPluginOptions = {}): Plugin {
  const opts = telemetryPluginOptionsSchema.parse(options)

  return {
    name: 'telemetry',
    onInit(cms: Kon10Instance) {
      const env = process.env
      const key = opts.posthog?.key ?? env.KON10_TELEMETRY_POSTHOG_KEY
      const host = opts.posthog?.host ?? env.KON10_TELEMETRY_POSTHOG_HOST ?? DEFAULT_HOST
      const disabled = opts.enabled === false || isTelemetryDisabled(env)

      if (disabled || !key) {
        // Leave `cms.telemetry` as the no-op default — nothing is ever sent.
        cms.logger.debug(
          { plugin: 'telemetry', reason: disabled ? 'disabled' : 'no-key' },
          'telemetry inert',
        )
        return
      }

      const { store, firstRun } = loadTelemetryStore(env)
      const distinctId =
        env.KON10_TELEMETRY_INSTANCE_ID ?? readProjectTelemetryId() ?? store.anonymousId
      const sink = createPosthogTelemetry({
        apiKey: key,
        host,
        distinctId,
        commonProperties: {
          nodeEnv: env.NODE_ENV ?? 'unknown',
          kon10Version: readKon10Version(),
          $process_person_profile: false,
          $geoip_disable: true,
        },
        debug: (message, error) => cms.logger.debug({ plugin: 'telemetry', err: error }, message),
      })
      cms.registerTelemetry(sink)

      // First-run disclosure (once per machine), Medusa-style.
      if (firstRun || !store.notified) {
        cms.logger.info(
          { plugin: 'telemetry' },
          'Kon10 collects usage data to help make the product better. We never ' +
            'see the content you manage. To turn it off, set ' +
            'KON10_DISABLE_TELEMETRY=1 (or DO_NOT_TRACK=1).',
        )
        markNotified(env)
      }

      // Technical boot event — versions, platform, and anonymous instance shape.
      const entityKinds = { collection: 0, document: 0, taxonomy: 0, custom: 0 }
      for (const entity of cms.entities) {
        if (entity.kind === 'collection') entityKinds.collection++
        else if (entity.kind === 'document') entityKinds.document++
        else if (entity.kind === 'taxonomy') entityKinds.taxonomy++
        else entityKinds.custom++
      }
      sink.capture({
        name: 'kon10_boot',
        properties: {
          telemetryVersion: TELEMETRY_VERSION,
          node: process.version,
          os: os.platform(),
          arch: os.arch(),
          modules: cms.modules.length,
          entities: cms.entities.length,
          collections: entityKinds.collection,
          documents: entityKinds.document,
          taxonomies: entityKinds.taxonomy,
          customEntities: entityKinds.custom,
          hasCache: cms.cache != null,
          hasStorage: cms.storage != null,
          isContainer: isContainer(env),
        },
      })
    },
  }
}
