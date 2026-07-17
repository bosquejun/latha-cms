---
'@kon10/cache': patch
---

`redisCache()` no longer opens its Redis connection eagerly. The default `ioredis` client is now constructed with `lazyConnect: true`, so the TCP connection is deferred until the first cache read/write instead of firing the moment the client is created. This fixes build-time `ECONNREFUSED 127.0.0.1:6379` failures on platforms like Vercel, where evaluating `kon10.config.*.ts` during the build would previously trigger an immediate connection attempt (falling back to localhost when `REDIS_URL` isn't populated yet). An `error` listener is also attached to the default client so transient connection errors are logged rather than surfacing as an unhandled `EventEmitter` error that crashes the process.
