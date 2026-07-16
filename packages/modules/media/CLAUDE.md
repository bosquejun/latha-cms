# @kon10/media — MediaModule

Owns media handling: the `MediaModule`, pluggable storage adapters, the `media` field type, the upload route, and the Studio media UI.

See root [`CLAUDE.md`](../../CLAUDE.md) for global rules.

## Owns

- **`MediaModule`** — `module.ts` (`MediaModule`, `MediaModuleConfig`): registers the `media` field type in `onInit` and contributes the media entity.
- **Field builder** — `builders.ts` (`media`): the `media` field type (`configSchema` `{ type:'media' }`, `buildDataSchema` → string reference).
- **Storage adapters** — `storage/` (`localDiskStorage`/`LocalDiskStorageOptions`, `s3Storage`/`S3StorageOptions` with a hand-rolled `sigv4.ts` signer): the pluggable backend for stored bytes.
- **Upload** — `upload.ts` (`uploadRoute`): the endpoint runners mount for uploads.
- **Studio UI** — `studio/fields/media-field.tsx`, `studio/lists/media-list.tsx`, via the `./studio` barrel.

## Must never contain

- Content-specific logic. Media is a generic asset concern; it must not know about collections, taxonomies, or documents.

## Conventions specific to media

- Storage adapters are **swappable** — anything implementing the storage contract works. Don't hardcode S3 or local disk assumptions into the module; keep them behind the adapter interface.
- `sigv4.ts` is a dependency-free AWS SigV4 signer (so `s3Storage` needs no AWS SDK). Test it (`sigv4.test.ts`) whenever touching signing.
- Register the `media` field type in `onInit`; augment `FieldTypeMap` for TS consumers.

## Tests

`node:test` against `dist/` (`module`, `upload`, `storage/local-disk`, `storage/s3`, `storage/sigv4`).
