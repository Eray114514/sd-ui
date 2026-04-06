export const dynamic = "force-dynamic"
import { prisma } from '@/lib/db'
import { processQueue } from '@/lib/queue'
import { createTaskSchema } from '@/lib/validations'
import { successResponse, handleApiError } from '@/lib/api-response'
import { createLogger } from '@/lib/logger'

const logger = createLogger('api:generate')

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const validated = createTaskSchema.parse(body)

        logger.info({ prompt: validated.prompt.substring(0, 50) }, 'Creating task')

        const task = await prisma.task.create({
            data: {
                prompt: validated.prompt,
                negative_prompt: validated.negative_prompt || '',
                styles: JSON.stringify(validated.styles || []),
                sampler_name: validated.sampler_name || 'Euler',
                scheduler: validated.scheduler || 'Automatic',
                steps: validated.steps || 30,
                cfg_scale: validated.cfg_scale || 5,
                width: validated.width || 896,
                height: validated.height || 1152,
                n_iter: validated.n_iter || 4,
                batch_size: validated.batch_size || 1,
                seed: validated.seed || -1,
                model_checkpoint: validated.override_settings?.sd_model_checkpoint || '',
            }
        })

        logger.info({ taskId: task.id }, 'Task created successfully')

        processQueue().catch((err) => {
            logger.error({ err }, 'Queue processing error')
        })

        return successResponse({ task })
    } catch (error) {
        return handleApiError(error)
    }
}
