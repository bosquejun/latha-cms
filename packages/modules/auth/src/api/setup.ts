/**
 * `GET auth/setup-status` + `POST auth/setup` — first-run admin creation.
 *
 * Both are public (no `requireStudioAccess`): a fresh install has no account to
 * authenticate as, which is the whole point. What stands in for authentication
 * is that setup only runs while the install is empty, plus — in production — a
 * token derived from `AUTH_SECRET` (see `../setup.js`).
 *
 * Setup is a capability of the *subject store*, not of this module: a store
 * that cannot `count` or `create` (an external IdP owns its own accounts) is
 * reported as unsupported rather than half-served.
 *
 * Like the login route, the session cookie is set directly on the returned
 * `Response`, so these run under any runner that speaks Fetch.
 */
import { z, type ModuleRoute, type ModuleRouteContext } from '@kon10/core'
import type { AuthUser } from '../types.js'
import { hashPassword } from '../crypto.js'
import { createSessionToken } from '../session.js'
import { resolveAuthOptions } from '../config.js'
import { serializeSetCookie } from '../cookie.js'
import { getUserById } from '../service.js'
import { getRoleByName } from '../rbac/seed.js'
import { setupTokenRequired, verifySetupToken } from '../setup.js'
import { getSubjectStore, type SubjectStore } from '../subject-store.js'
import { toSessionUser } from './session-user.js'

// Avoid a hard @types/node dependency for one env var.
declare const process: { env: Record<string, string | undefined> }

/** The first account created is a full admin, so it gets a real minimum. */
export const MIN_PASSWORD_LENGTH = 12

/**
 * The first admin's credentials. Zod-first: the inferred type is the contract,
 * and this is the only place the password policy is stated.
 */
export const setupInputSchema = z.object({
  email: z.email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  name: z.string().optional(),
  /** Required in production only; see `../setup.js`. */
  token: z.string().optional(),
})

export type SetupInput = z.infer<typeof setupInputSchema>

/** A store can only drive setup if it can both detect an empty install and fill it. */
function supportsSetup(
  store: SubjectStore,
): store is SubjectStore & Required<Pick<SubjectStore, 'count' | 'create'>> {
  return typeof store.count === 'function' && typeof store.create === 'function'
}

function fail(error: string): Response {
  return Response.json({ ok: false, user: null, error })
}

async function handleSetupStatus({ cms }: ModuleRouteContext): Promise<Response> {
  // `tokenRequired` is reported up front so the setup page can ask for the
  // token before the form, rather than letting someone fill it all in and only
  // then fail. Whether a token is needed is server state (it tracks NODE_ENV),
  // so the client cannot infer it.
  const tokenRequired = setupTokenRequired()
  const store = getSubjectStore(cms)
  if (!supportsSetup(store)) {
    return Response.json({ supported: false, needsSetup: false, tokenRequired })
  }
  return Response.json({
    supported: true,
    needsSetup: (await store.count()) === 0,
    tokenRequired,
  })
}

async function handleSetup({ cms, request }: ModuleRouteContext): Promise<Response> {
  const store = getSubjectStore(cms)
  if (!supportsSetup(store)) {
    return fail('This installation does not support first-run setup.')
  }

  const parsed = setupInputSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'Invalid setup details.')
  }
  const { email, password, name, token } = parsed.data

  const opts = resolveAuthOptions()
  if (setupTokenRequired() && !(await verifySetupToken(token, opts.secret))) {
    return fail('A valid setup token is required to create the first admin in production.')
  }

  // Re-check immediately before creating. This narrows, but cannot close, the
  // window between check and create: the DBAdapter exposes no transaction, so
  // two simultaneous submissions could both pass. Reaching this line already
  // requires the token in production, so the residual race is between holders
  // of the secret.
  if ((await store.count()) !== 0) {
    return fail('Setup has already been completed.')
  }

  const adminRole = await getRoleByName(cms, 'admin')
  const subject = await store.create({
    email,
    name,
    passwordHash: await hashPassword(password),
    roles: adminRole ? [adminRole.id] : [],
  })

  // Re-read through `getUserById` so the response carries resolved role names
  // and effective permissions — the same wire shape `loginRoute` returns.
  // `store.create` hands back the raw stored subject (role *ids*, no
  // permissions), which would make setup and login disagree about the same user.
  const user = (await getUserById(cms, subject.id)) ?? (subject as AuthUser)

  const sessionToken = await createSessionToken({ sub: subject.id }, opts.secret, opts.sessionTtlSeconds)
  const cookie = serializeSetCookie(opts.cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] !== 'development',
    sameSite: 'lax',
    path: '/',
    maxAge: opts.sessionTtlSeconds,
  })

  return Response.json(
    { ok: true, user: toSessionUser(user) },
    { headers: { 'set-cookie': cookie } },
  )
}

export const setupStatusRoute: ModuleRoute = { method: 'GET', handler: handleSetupStatus }
export const setupRoute: ModuleRoute = { method: 'POST', handler: handleSetup }
