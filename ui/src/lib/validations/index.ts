import { z } from 'zod'

export const generateRequestSchema = z.object({
    prompt: z.string().min(1, '提示词不能为空').max(10000, '提示词过长'),
    negative_prompt: z.string().max(5000).optional(),
    styles: z.array(z.string()).optional().default([]),
    sampler_name: z.string().optional().default('Euler'),
    scheduler: z.string().optional().default('Automatic'),
    steps: z.number().int().min(1).max(150).optional().default(30),
    cfg_scale: z.number().min(0).max(30).optional().default(5),
    width: z.number().int().min(64).max(2048).optional().default(896),
    height: z.number().int().min(64).max(2048).optional().default(1152),
    n_iter: z.number().int().min(1).max(100).optional().default(4),
    batch_size: z.number().int().min(1).max(8).optional().default(1),
    seed: z.number().int().optional().default(-1),
    override_settings: z.object({
        sd_model_checkpoint: z.string().optional(),
    }).optional(),
})

export const settingsUpdateSchema = z.object({
    imageDir: z.string().min(1, '图片目录不能为空'),
    activeLoras: z.string().optional(),
})

export const createTaskSchema = z.object({
    prompt: z.string().min(1, '提示词不能为空').max(10000),
    negative_prompt: z.string().max(5000).optional(),
    styles: z.array(z.string()).optional(),
    sampler_name: z.string().optional(),
    scheduler: z.string().optional(),
    steps: z.number().int().min(1).max(150).optional(),
    cfg_scale: z.number().min(0).max(30).optional(),
    width: z.number().int().min(64).max(2048).optional(),
    height: z.number().int().min(64).max(2048).optional(),
    n_iter: z.number().int().min(1).max(100).optional(),
    batch_size: z.number().int().min(1).max(8).optional(),
    seed: z.number().int().optional(),
    override_settings: z.object({
        sd_model_checkpoint: z.string().optional(),
    }).optional(),
})

export type GenerateRequest = z.infer<typeof generateRequestSchema>
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
export type CreateTaskRequest = z.infer<typeof createTaskSchema>
