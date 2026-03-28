import { describe, it, expect } from 'vitest'
import {
    BusinessError,
    ValidationError,
    ApiError,
    SDApiError,
    toApiError,
    getErrorMessage,
} from '@/errors'
import { ZodError } from 'zod'

describe('BusinessError', () => {
    it('should create a business error with default code', () => {
        const error = new BusinessError('Something went wrong')
        expect(error.message).toBe('Something went wrong')
        expect(error.code).toBe('BUSINESS_ERROR')
        expect(error.name).toBe('BusinessError')
    })

    it('should create a business error with custom code', () => {
        const error = new BusinessError('Not found', 'NOT_FOUND')
        expect(error.code).toBe('NOT_FOUND')
    })
})

describe('ValidationError', () => {
    it('should create from ZodError', () => {
        const zodError = new ZodError([
            {
                code: 'too_small',
                minimum: 1,
                origin: 'string',
                path: ['prompt'],
                message: '提示词不能为空',
            },
        ])

        const validationError = ValidationError.fromZodError(zodError)
        expect(validationError.message).toBe('Validation failed')
        expect(validationError.issues).toHaveLength(1)
        expect(validationError.issues[0].path).toBe('prompt')
        expect(validationError.issues[0].message).toBe('提示词不能为空')
    })
})

describe('ApiError', () => {
    it('should create static factory errors', () => {
        const badRequest = ApiError.badRequest('Invalid input')
        expect(badRequest.status).toBe(400)
        expect(badRequest.code).toBe('BAD_REQUEST')

        const unauthorized = ApiError.unauthorized()
        expect(unauthorized.status).toBe(401)
        expect(unauthorized.message).toBe('Unauthorized')

        const forbidden = ApiError.forbidden()
        expect(forbidden.status).toBe(403)

        const notFound = ApiError.notFound()
        expect(notFound.status).toBe(404)

        const internal = ApiError.internal()
        expect(internal.status).toBe(500)

        const serviceUnavailable = ApiError.serviceUnavailable('Service down')
        expect(serviceUnavailable.status).toBe(503)
    })
})

describe('SDApiError', () => {
    it('should create SD API error', () => {
        const error = new SDApiError('Connection failed', 502, 'ECONNREFUSED', { detail: 'test' })
        expect(error.message).toBe('Connection failed')
        expect(error.statusCode).toBe(502)
        expect(error.errorCode).toBe('ECONNREFUSED')
        expect(error.responseData).toEqual({ detail: 'test' })
    })
})

describe('toApiError', () => {
    it('should convert ValidationError to ApiError', () => {
        const validationError = new ValidationError('Test', [{ path: 'field', message: 'Invalid' }])
        const apiError = toApiError(validationError)
        expect(apiError.status).toBe(400)
        expect(apiError.code).toBe('VALIDATION_ERROR')
    })

    it('should convert BusinessError to ApiError', () => {
        const businessError = new BusinessError('Not found', 'NOT_FOUND')
        const apiError = toApiError(businessError)
        expect(apiError.status).toBe(400)
        expect(apiError.code).toBe('NOT_FOUND')
    })

    it('should convert generic Error to ApiError', () => {
        const error = new Error('Something went wrong')
        const apiError = toApiError(error)
        expect(apiError.message).toBe('Something went wrong')
        expect(apiError.code).toBe('UNKNOWN_ERROR')
        expect(apiError.status).toBe(500)
    })
})

describe('getErrorMessage', () => {
    it('should return string as is', () => {
        expect(getErrorMessage('test message')).toBe('test message')
    })

    it('should return error message from Error', () => {
        expect(getErrorMessage(new Error('error message'))).toBe('error message')
    })

    it('should return Unknown error for unknown types', () => {
        expect(getErrorMessage(null)).toBe('Unknown error')
        expect(getErrorMessage(undefined)).toBe('Unknown error')
        expect(getErrorMessage(123)).toBe('Unknown error')
    })
})
