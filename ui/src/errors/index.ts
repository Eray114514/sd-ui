export class BusinessError extends Error {
  constructor(
    message: string,
    public code: string = 'BUSINESS_ERROR',
    public details?: unknown
  ) {
    super(message)
    this.name = 'BusinessError'
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof BusinessError) {
    return new ApiError(error.message, error.code, 400, error.details)
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 'UNKNOWN_ERROR')
  }
  return new ApiError('Unknown error', 'UNKNOWN_ERROR')
}

export function parseApiErrorResponse(error: unknown): {
  message: string
  status?: number
  code?: string
} {
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    return {
      message: (err.message as string) || 'Unknown error',
      status: err.status as number | undefined,
      code: err.code as string | undefined,
    }
  }
  return { message: 'Unknown error' }
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>
    if (err.message && typeof err.message === 'string') return err.message
  }
  return 'Unknown error'
}
