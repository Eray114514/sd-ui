import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import {
  ApiError,
  BusinessError,
  ValidationError,
  toApiError,
} from '@/errors'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api-response')

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: unknown
  }
}

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(
  message: string,
  code: string = 'UNKNOWN_ERROR',
  status: number = 500,
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: { message, code, details },
    },
    { status }
  )
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  if (error instanceof ZodError) {
    const validationError = ValidationError.fromZodError(error)
    logger.warn({ issues: validationError.issues }, 'Validation error')
    return errorResponse(
      validationError.message,
      'VALIDATION_ERROR',
      400,
      { issues: validationError.issues }
    )
  }

  if (error instanceof ValidationError) {
    logger.warn({ issues: error.issues }, 'Validation error')
    return errorResponse(error.message, 'VALIDATION_ERROR', 400, { issues: error.issues })
  }

  if (error instanceof BusinessError) {
    logger.warn({ code: error.code, message: error.message }, 'Business error')
    return errorResponse(error.message, error.code, 400, error.details)
  }

  if (error instanceof ApiError) {
    logger.error({ code: error.code, status: error.status, message: error.message }, 'API error')
    return errorResponse(error.message, error.code, error.status, error.details)
  }

  const apiError = toApiError(error)
  logger.error({ error }, 'Unexpected error')
  return errorResponse(apiError.message, apiError.code, apiError.status, apiError.details)
}

export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<ApiResponse<T>>>
): Promise<NextResponse<ApiResponse<T | undefined>>> {
  return handler().catch(handleApiError) as Promise<NextResponse<ApiResponse<T | undefined>>>
}
