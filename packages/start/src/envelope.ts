/**
 * The response envelope for the public delivery API (`@latha/start/api`) —
 * every response, success or failure, is shaped the same way so a client
 * never has to branch on transport before it can branch on outcome:
 *
 *   { data: T,    error: null,     pagination?: ApiPagination }  // success
 *   { data: null, error: ApiError }                              // failure
 *
 * `data` is the resource itself: an object for a single document/global, an
 * array for a list. `pagination` only ever appears alongside a list `data`.
 *
 * Zod-first: `apiResponseSchema()` is the schema clients import to validate a
 * fetched response; `ApiResponse<T>` is the type derived from it. Server-side
 * responses are built with `apiSuccess()` / `apiFailure()` so every call site
 * produces an envelope that satisfies the same schema.
 */
import { z } from '@latha/core'

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
})
export type ApiError = z.infer<typeof apiErrorSchema>

/** Present only on list responses. */
export const apiPaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
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
export function apiFailure(code: ApiErrorCode, message: string): ApiResponse<never> {
  return { data: null, error: { code, message } }
}

/** Derive the `pagination` block from a list page's limit/offset/total. */
export function apiPaginationOf(total: number, limit: number, offset: number): ApiPagination {
  return { total, limit, offset, hasMore: offset + limit < total }
}
