import { ZodError } from 'zod'

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

export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: Array<{ path: string; message: string }>
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  static fromZodError(error: ZodError): ValidationError {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return new ValidationError('Validation failed', issues)
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(message, 'BAD_REQUEST', 400, details)
  }

  static unauthorized(message: string = 'Unauthorized'): ApiError {
    return new ApiError(message, 'UNAUTHORIZED', 401)
  }

  static forbidden(message: string = 'Forbidden'): ApiError {
    return new ApiError(message, 'FORBIDDEN', 403)
  }

  static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError(message, 'NOT_FOUND', 404)
  }

  static internal(message: string = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(message, 'INTERNAL_ERROR', 500, details)
  }

  static serviceUnavailable(message: string, details?: unknown): ApiError {
    return new ApiError(message, 'SERVICE_UNAVAILABLE', 503, details)
  }
}

export class SDApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public responseData?: unknown
  ) {
    super(message)
    this.name = 'SDApiError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

export function isSDApiError(error: unknown): error is SDApiError {
  return error instanceof SDApiError
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof ValidationError) {
    return new ApiError(error.message, 'VALIDATION_ERROR', 400, { issues: error.issues })
  }
  if (error instanceof BusinessError) {
    return new ApiError(error.message, error.code, 400, error.details)
  }
  if (error instanceof Error) {
    return new ApiError(error.message, 'UNKNOWN_ERROR', 500)
  }
  return new ApiError('Unknown error', 'UNKNOWN_ERROR', 500)
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
