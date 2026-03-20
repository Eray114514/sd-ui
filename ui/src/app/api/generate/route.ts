import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { processQueue } from '@/lib/queue'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const task = await prisma.task.create({
            data: {
                prompt: body.prompt,
                negative_prompt: body.negative_prompt || '',
                styles: JSON.stringify(body.styles || []),
                sampler_name: body.sampler_name || 'Euler',
                scheduler: body.scheduler || 'Automatic',
                steps: body.steps || 30,
                cfg_scale: body.cfg_scale || 5,
                width: body.width || 896,
                height: body.height || 1152,
                n_iter: body.n_iter || 4,
                batch_size: body.batch_size || 1,
                seed: body.seed || -1,
                model_checkpoint: body.override_settings?.sd_model_checkpoint || '',
            }
        })

        // Fire and forget queue processor
        processQueue().catch(console.error)

        return NextResponse.json({ success: true, task })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
