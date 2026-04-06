import { ZodError } from 'zod'

/**
 * 基础应用错误类
 */
export class AppError extends Error {
  constructor(message: string, public code: string, public status: number = 500, public details?: unknown) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * 业务逻辑错误 (400 Bad Request)
 * 场景：任务状态不正确、权限不足、配置缺失等业务规则校验失败
 */
export class BusinessError extends AppError {
  constructor(
    message: string,
    code: string = 'BUSINESS_ERROR',
    details?: unknown
  ) {
    super(message, code, 400, details)
    this.name = 'BusinessError'
  }
}

/**
 * 验证错误 (400 Bad Request)
 * 场景：API请求参数格式不正确，通常由 Zod 抛出
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public issues: Array<{ path: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR', 400, { issues })
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

/**
 * 通用 API 错误
 * 场景：通用的 HTTP 请求错误（如 404 Not Found, 401 Unauthorized, 500 Internal Server Error）
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    code: string,
    status: number = 500,
    details?: unknown
  ) {
    super(message, code, status, details)
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

/**
 * SD WebUI 专用错误
 * 场景：与下游 SD WebUI 服务通信时发生的错误（超时、502、生成失败等）
 */
export class SDApiError extends AppError {
  constructor(
    message: string,
    public statusCode: number = 500,
    errorCode: string = 'SD_API_ERROR',
    public responseData?: unknown
  ) {
    super(message, errorCode, statusCode, responseData)
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
  if (error instanceof AppError) {
    return new ApiError(error.message, error.code, error.status, error.details)
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
