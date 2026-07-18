import type { Kon10Config } from '@kon10/core'

export const studio: NonNullable<Kon10Config['studio']> = {
  branding: {
    appName: 'Kon10',
    tagline: 'Everything you publish, in one place.',
    taglineSubtitle:
      'Model content, manage media, and ship a fast delivery API, all from your Studio.',
    signUpUrl: '/signup',
  },
  telemetryNotice: {
    enabled: true,
    mode: 'opt-out',
    manageUrl: '/studio/settings/telemetry',
    policyUrl: 'https://example.com/privacy',
  },
}
