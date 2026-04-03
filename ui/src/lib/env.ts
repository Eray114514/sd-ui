import { config } from 'dotenv'
import { z } from 'zod'

config()

const envSchema = z.object({
    DATABASE_URL: z.string().optional(),
    SD_WEBUI_BASE_URL: z.string().url().optional().default('http://localhost:7860'),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional().default('info'),
})

function validateEnv() {
    const parsed = envSchema.safeParse(process.env)

    if (!parsed.success) {
        console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
        throw new Error('Invalid environment variables')
    }

    return parsed.data
}

export const env = validateEnv()

export type Env = z.infer<typeof envSchema>
