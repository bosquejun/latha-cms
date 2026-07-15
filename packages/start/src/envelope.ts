/**
 * The delivery-API response envelope now lives in `@kon10/client`, the neutral
 * home shared by both sides of the network boundary — the server (this package)
 * builds envelopes with `apiSuccess()` / `apiFailure()`, and the delivery client
 * validates them with `apiResponseSchema()`. This module re-exports that
 * contract so `@kon10/start/envelope` and every existing internal import keep
 * resolving unchanged.
 */
export {
  API_ERROR_CODES,
  apiErrorSchema,
  apiPaginationSchema,
  apiResponseSchema,
  apiSuccess,
  apiFailure,
  apiPaginationOf,
  type ApiErrorCode,
  type ApiError,
  type ApiPagination,
  type ApiResponse,
} from '@kon10/client'
