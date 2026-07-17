# @kon10/cache

## 1.0.3

### Patch Changes

- e48077f: `redisCache()` no longer opens its Redis connection eagerly. The default `ioredis` client is now constructed with `lazyConnect: true`, so the TCP connection is deferred until the first cache read/write instead of firing the moment the client is created. This fixes build-time `ECONNREFUSED 127.0.0.1:6379` failures on platforms like Vercel, where evaluating `kon10.config.*.ts` during the build would previously trigger an immediate connection attempt (falling back to localhost when `REDIS_URL` isn't populated yet). An `error` listener is also attached to the default client so transient connection errors are logged rather than surfacing as an unhandled `EventEmitter` error that crashes the process.
  - @kon10/core@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies [edeab7e]
  - @kon10/core@1.0.2

## 1.0.1

### Patch Changes

- Updated dependencies [6e7fe1c]
- Updated dependencies [fe180c5]
- Updated dependencies [5c52497]
- Updated dependencies [424296e]
  - @kon10/core@1.0.1

## 1.0.0

### Patch Changes

- @kon10/core@1.0.0
