import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import { getDefaultImageDir, normalizeImageDir } from '@/lib/paths'

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.promises.access(filePath, fs.constants.R_OK)
        return true
    } catch {
        return false
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const originalPath = searchParams.get('path')

    if (!originalPath) {
        return new NextResponse('Missing path parameter', { status: 400 })
    }

    let filePath = originalPath
    let shouldUpdatePath = false

    // 1. Check if original path exists (async)
    if (!(await fileExists(filePath))) {
        // 2. If not, try to find file in current configured imageDir
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } })
            
            const rawDir = config?.imageDir || getDefaultImageDir()
            const currentDir = normalizeImageDir(rawDir)
            
            const filename = path.basename(originalPath)
            const newPath = path.join(currentDir, filename)

            if (await fileExists(newPath)) {
                filePath = newPath
                shouldUpdatePath = true
            } else {
                return new NextResponse('Image not found', { status: 404 })
            }
        } catch {
            console.error("Error resolving image path")
            return new NextResponse('Internal Server Error', { status: 500 })
        }
    }

    // 3. Stream file (async, non-blocking)
    try {
        const stat = await fs.promises.stat(filePath)
        const stream = fs.createReadStream(filePath)
        
        // Convert Node.js ReadableStream to Web ReadableStream
        const webStream = new ReadableStream({
            start(controller) {
                stream.on('data', (chunk) => controller.enqueue(chunk))
                stream.on('end', () => controller.close())
                stream.on('error', (err) => controller.error(err))
            },
            cancel() {
                stream.destroy()
            }
        })

        // 4. Update database if path changed (fire-and-forget)
        if (shouldUpdatePath) {
            prisma.generatedImage.findFirst({
                where: { path: originalPath }
            }).then((image: any) => {
                if (image) {
                    return prisma.generatedImage.update({
                        where: { id: image.id },
                        data: { path: filePath }
                    })
                }
            }).catch((err: unknown) => console.error("Failed to update image path in DB:", err))
        }

        return new NextResponse(webStream, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': stat.size.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        })
    } catch {
        return new NextResponse('Error reading file', { status: 500 })
    }
}
