export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getDefaultImageDir, normalizeImageDir } from "@/lib/paths"
import { apiCache, cacheKeys } from "@/lib/cache"
import { settingsUpdateSchema } from "@/lib/validations"
import { handleApiError } from "@/lib/api-response"
import { createLogger } from "@/lib/logger"

const logger = createLogger('api:settings')

export async function GET() {
    try {
        const cached = apiCache.get(cacheKeys.settings)
        if (cached) {
            return NextResponse.json(cached)
        }

        let config = await prisma.systemConfig.findUnique({ where: { id: 'default' } })
        if (!config) {
            config = await prisma.systemConfig.create({
                data: { id: "default", imageDir: getDefaultImageDir() },
            })
        }

        apiCache.set(cacheKeys.settings, config)
        return NextResponse.json(config)
    } catch (error) {
        return handleApiError(error)
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { imageDir, activeLoras } = settingsUpdateSchema.parse(body)

        logger.info({ imageDir, activeLoras }, 'Updating settings')

        const normalizedDir = normalizeImageDir(imageDir)
        const updateData: { imageDir: string; activeLoras?: string } = { imageDir: normalizedDir }
        if (activeLoras !== undefined) {
            updateData.activeLoras = activeLoras
        }

        const config = await prisma.systemConfig.upsert({
            where: { id: 'default' },
            update: updateData,
            create: { id: "default", imageDir: normalizedDir, activeLoras: activeLoras || "[]" }
        })

        apiCache.invalidate(cacheKeys.settings)
        logger.info({ imageDir: normalizedDir, activeLoras }, 'Settings updated')

        return NextResponse.json(config)
    } catch (error) {
        return handleApiError(error)
    }
}
