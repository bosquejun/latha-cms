/**
 * The response envelope for the public delivery API — every response, success
 * or failure, is shaped the same way so a client never has to branch on
 * transport before it can branch on outcome:
 *
 *   { data: T,    error: null,     pagination?: ApiPagination }  // success
 *   { data: null, error: ApiError }                              // failure
 *
 * `data` is the resource itself: an object for a single document/global, an
 * array for a list. `pagination` only ever appears alongside a list `data`.
 *
 * This module is the single source of truth for the wire contract, shared by
 * both sides of the network boundary: the server (`@kon10/start`) builds
 * responses with `apiSuccess()` / `apiFailure()`, and the delivery client
 * (`@kon10/client`) validates fetched responses with `apiResponseSchema()`.
 * It depends only on `zod` — never on the kernel or any module — so the
 * client stays light enough to drop into any consumer website.
 *
 * Zod-first: `apiResponseSchema()` is the schema clients import to validate a
 * fetched response; `ApiResponse<T>` is the type derived from it.
 */
import { z } from 'zod'

/** Stable, machine-readable failure codes the delivery API can return. */
export const API_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

/** The only shape an error ever takes on the wire. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  /**
   * Correlation id for this request's server log lines. Present on failures
   * the server logged (always on `INTERNAL_ERROR`) — quote it when reporting
   * a problem. Optional and additive: envelopes validated against an older
   * schema still parse.
   */
  requestId: z.string().optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>

/** Present only on list responses. 1-indexed, like the `page`/`pageSize` query params. */
export const apiPaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
})
export type ApiPagination = z.infer<typeof apiPaginationSchema>

/**
 * Build the full envelope schema for one endpoint's `data` shape, e.g.
 * `apiResponseSchema(z.array(postSchema))` for a list, `apiResponseSchema(postSchema)`
 * for a single resource. Clients use this to validate/parse a fetched response.
 */
export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([
    z.object({
      data: dataSchema,
      error: z.null(),
      pagination: apiPaginationSchema.optional(),
    }),
    z.object({
      data: z.null(),
      error: apiErrorSchema,
    }),
  ])
}

/** The plain TS equivalent of `apiResponseSchema()`, for typing without invoking Zod. */
export type ApiResponse<T> =
  | { data: T; error: null; pagination?: ApiPagination }
  | { data: null; error: ApiError }

/** Build a success envelope. Pass `pagination` only when `data` is a list page. */
export function apiSuccess<T>(data: T, pagination?: ApiPagination): ApiResponse<T> {
  return pagination ? { data, error: null, pagination } : { data, error: null }
}

/** Build a failure envelope. `data` is always `null` on failure. */
export function apiFailure(
  code: ApiErrorCode,
  message: string,
  requestId?: string,
): ApiResponse<never> {
  return { data: null, error: requestId ? { code, message, requestId } : { code, message } }
}

/** Derive the `pagination` block from a list page's page/pageSize/total. */
export function apiPaginationOf(total: number, page: number, pageSize: number): ApiPagination {
  return { page, pageSize, total, hasMore: page * pageSize < total }
}
