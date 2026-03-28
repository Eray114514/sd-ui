import { describe, it, expect } from 'vitest'
import {
    generateRequestSchema,
    createTaskSchema,
    settingsUpdateSchema,
} from '@/lib/validations'

describe('generateRequestSchema', () => {
    it('should validate a valid request', () => {
        const result = generateRequestSchema.safeParse({
            prompt: 'a beautiful sunset',
        })
        expect(result.success).toBe(true)
    })

    it('should fail with empty prompt', () => {
        const result = generateRequestSchema.safeParse({
            prompt: '',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('提示词不能为空')
        }
    })

    it('should fail with prompt too long', () => {
        const result = generateRequestSchema.safeParse({
            prompt: 'a'.repeat(10001),
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('提示词过长')
        }
    })

    it('should apply default values', () => {
        const result = generateRequestSchema.parse({
            prompt: 'test prompt',
        })
        expect(result.steps).toBe(30)
        expect(result.cfg_scale).toBe(5)
        expect(result.width).toBe(896)
        expect(result.height).toBe(1152)
        expect(result.n_iter).toBe(4)
        expect(result.batch_size).toBe(1)
        expect(result.seed).toBe(-1)
        expect(result.sampler_name).toBe('Euler')
        expect(result.scheduler).toBe('Automatic')
        expect(result.styles).toEqual([])
    })

    it('should validate steps range', () => {
        const result = generateRequestSchema.safeParse({
            prompt: 'test',
            steps: 200,
        })
        expect(result.success).toBe(false)
    })

    it('should validate width and height range', () => {
        const result = generateRequestSchema.safeParse({
            prompt: 'test',
            width: 3000,
        })
        expect(result.success).toBe(false)
    })
})

describe('createTaskSchema', () => {
    it('should validate a valid task', () => {
        const result = createTaskSchema.safeParse({
            prompt: 'test prompt',
        })
        expect(result.success).toBe(true)
    })

    it('should fail with empty prompt', () => {
        const result = createTaskSchema.safeParse({
            prompt: '',
        })
        expect(result.success).toBe(false)
    })
})

describe('settingsUpdateSchema', () => {
    it('should validate a valid image directory', () => {
        const result = settingsUpdateSchema.safeParse({
            imageDir: '/home/user/images',
        })
        expect(result.success).toBe(true)
    })

    it('should fail with empty image directory', () => {
        const result = settingsUpdateSchema.safeParse({
            imageDir: '',
        })
        expect(result.success).toBe(false)
    })
})
