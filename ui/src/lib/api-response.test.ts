import { describe, it, expect } from 'vitest'
import { successResponse, errorResponse, handleApiError } from '@/lib/api-response'
import { ApiError, BusinessError, ValidationError } from '@/errors'
import { ZodError } from 'zod'

describe('api-response', () => {
    describe('successResponse', () => {
        it('should create a success response', async () => {
            const response = successResponse({ id: 1, name: 'test' })
            const json = await response.json()
            expect(json.success).toBe(true)
            expect(json.data).toEqual({ id: 1, name: 'test' })
        })

        it('should use custom status code', () => {
            const response = successResponse({ created: true }, 201)
            expect(response.status).toBe(201)
        })
    })

    describe('errorResponse', () => {
        it('should create an error response', async () => {
            const response = errorResponse('Not found', 'NOT_FOUND', 404)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.message).toBe('Not found')
            expect(json.error?.code).toBe('NOT_FOUND')
            expect(response.status).toBe(404)
        })
    })

    describe('handleApiError', () => {
        it('should handle ZodError', async () => {
            const zodError = new ZodError([
                { code: 'too_small', minimum: 1, origin: 'string', path: ['prompt'], message: 'Required' },
            ])
            const response = handleApiError(zodError)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.code).toBe('VALIDATION_ERROR')
            expect(response.status).toBe(400)
        })

        it('should handle ValidationError', async () => {
            const error = new ValidationError('Invalid', [{ path: 'field', message: 'Required' }])
            const response = handleApiError(error)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.code).toBe('VALIDATION_ERROR')
        })

        it('should handle BusinessError', async () => {
            const error = new BusinessError('Task not found', 'TASK_NOT_FOUND')
            const response = handleApiError(error)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.code).toBe('TASK_NOT_FOUND')
            expect(response.status).toBe(400)
        })

        it('should handle ApiError', async () => {
            const error = ApiError.notFound('Task not found')
            const response = handleApiError(error)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.code).toBe('NOT_FOUND')
            expect(response.status).toBe(404)
        })

        it('should handle generic Error', async () => {
            const error = new Error('Something went wrong')
            const response = handleApiError(error)
            const json = await response.json()
            expect(json.success).toBe(false)
            expect(json.error?.message).toBe('Something went wrong')
            expect(response.status).toBe(500)
        })
    })
})
