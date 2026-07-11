# Security Policy

Kon10 ships authentication, session, and access-control code, so we take
security reports seriously and appreciate responsible disclosure.

## Supported versions

| Version | Supported |
|---|---|
| 1.x (latest minor) | ✅ |
| < 1.0 | ❌ |

Only the latest minor release of the 1.x line receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/bosquejun/kon10/security/advisories/new)
("Report a vulnerability" on the repository's Security tab).

Include what you can:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected package(s) and version(s)

## What to expect

- **Acknowledgement** within 5 business days.
- **Assessment and fix plan** communicated through the advisory thread.
- Once a fix is released, the advisory is published with credit to the
  reporter (unless you prefer to stay anonymous).

## Scope notes

- The seeded first-run admin credentials (`admin@kon10.dev` / `password`)
  are a documented development default, not a vulnerability — production
  deployments must override them (see `docs/deployment.md`).
- The built-in login throttle is per-instance and in-memory by design;
  deployments needing hard rate limits should put a rate limiter in front
  (also covered in `docs/deployment.md`).
