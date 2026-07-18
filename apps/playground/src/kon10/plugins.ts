import type { Plugin } from '@kon10/core'
import { sentryTracingPlugin } from '@kon10/sentry'
import { telemetryPlugin } from '@kon10/telemetry'
import { slugPlugin } from '@kon10/slug'
import { seoPlugin } from '@kon10/seo'

export function createPlugins(): Plugin[] {
  return [
    telemetryPlugin(),
    slugPlugin(),
    seoPlugin({ inject: ['pages'], titleTemplate: '%s · Kon10' }),
    ...(process.env.SENTRY_DSN
      ? [
          sentryTracingPlugin({
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV,
            tracesSampleRate: 1,
            enableLogs: true,
          }),
        ]
      : []),
  ]
}
