import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs/promises'
import { successResponse, handleApiError } from '@/lib/api-response'
import { createLogger } from '@/lib/logger'
import { deleteTaskSchema } from '@/lib/validations/tasks'

const logger = createLogger('api:tasks')

export async function GET() {
    try {
        const tasks = await prisma.task.findMany({
            orderBy: [
                { createdAt: 'desc' },
                { id: 'desc' }
            ],
            take: 500,
            include: { images: true }
        })

        logger.debug({ count: tasks.length }, 'Fetched tasks')

        return NextResponse.json(tasks.reverse(), {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })
    } catch (error) {
        return handleApiError(error)
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json()
        const { id } = deleteTaskSchema.parse(body)

        logger.info({ taskId: id }, 'Deleting task')

        const images = await prisma.generatedImage.findMany({
            where: { taskId: id }
        })

        for (const img of images) {
            try {
                await fs.access(img.path)
                await fs.unlink(img.path)
            } catch {
                logger.debug({ path: img.path }, 'File not found or cannot be accessed')
            }
        }

        await prisma.generatedImage.deleteMany({
            where: { taskId: id }
        })

        await prisma.task.delete({
            where: { id }
        })

        logger.info({ taskId: id }, 'Task deleted successfully')

        return successResponse({ deleted: true })
    } catch (error) {
        return handleApiError(error)
    }
}
