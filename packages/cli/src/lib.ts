/**
 * Programmatic entry for `@kon10/cli` — the same building blocks the `kon10`
 * binary uses, for scripts and build steps that want to generate types in
 * process rather than shelling out.
 */
export { generateTypes, type GenerateOptions } from './typegen.js'
export {
  fetchManifest,
  parseManifest,
  manifestSchema,
  manifestEntitySchema,
  type Manifest,
  type ManifestEntity,
  type FetchManifestOptions,
} from './manifest.js'
