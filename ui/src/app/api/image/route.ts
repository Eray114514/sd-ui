import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/db'
import { getDefaultImageDir, normalizeImageDir } from '@/lib/paths'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const originalPath = searchParams.get('path')

    if (!originalPath) {
        return new NextResponse('Missing path parameter', { status: 400 })
    }

    let filePath = originalPath
    let shouldUpdatePath = false

    // 1. Check if original path exists
    if (!fs.existsSync(filePath)) {
        // 2. If not, try to find file in current configured imageDir
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } })
            
            // Handle case where config might be null (though unlikely if app initialized correctly)
            const rawDir = config?.imageDir || getDefaultImageDir()
            const currentDir = normalizeImageDir(rawDir)
            
            // originalPath is like "D:\OldDir\file.png" or "/home/old/file.png"
            const filename = path.basename(originalPath)
            const newPath = path.join(currentDir, filename)

            if (fs.existsSync(newPath)) {
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

    // 3. Read file
    try {
        const file = fs.readFileSync(filePath)
        
        // 4. Update database if path changed
        if (shouldUpdatePath) {
            prisma.generatedImage.findFirst({
                where: { path: originalPath }
            }).then((image) => {
                if (image) {
                    return prisma.generatedImage.update({
                        where: { id: image.id },
                        data: { path: filePath }
                    })
                }
            }).catch((err: unknown) => console.error("Failed to update image path in DB:", err))
        }

        return new NextResponse(file, {
            headers: {
                'Content-Type': 'image/png',
                // Add caching for performance
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        })
    } catch {
        return new NextResponse('Error reading file', { status: 500 })
    }
}
