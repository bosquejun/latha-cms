/**
 * `@kon10/client` — the framework-agnostic headless delivery SDK.
 *
 * Re-exports the delivery client and the response-envelope contract (the
 * single source of truth for the wire format, shared with `@kon10/start`).
 */
export {
  createDeliveryClient,
  DeliveryError,
  DEFAULT_API_PATH,
  type DeliveryClient,
  type DeliveryClientOptions,
  type ListOptions,
  type GetOptions,
  type ListResult,
  type JsonDoc,
  type WhereValue,
} from './client.js'

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
} from './envelope.js'
