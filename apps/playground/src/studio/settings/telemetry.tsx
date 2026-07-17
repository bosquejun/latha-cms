/**
 * Settings → Telemetry — the per-user opt-out toggles, provided ready-made by
 * `@kon10/start`. Dropping this one file under `src/studio/settings/` mounts it
 * at `/studio/settings/telemetry`.
 */

import { TelemetrySettings, defineSettingsConfig } from '@kon10/start'
import { ShieldCheck } from 'lucide-react'

export const config = defineSettingsConfig({
  path: 'telemetry',
  label: 'Telemetry',
  description: 'Usage monitoring and privacy',
  icon: ShieldCheck,
})

export default TelemetrySettings
