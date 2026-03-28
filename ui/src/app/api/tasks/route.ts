import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs/promises'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    take: 500,
    include: { images: true }
  })
  return NextResponse.json(tasks.reverse(), {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    }
  })
}

export async function DELETE(req: Request) {
  let id
  try {
    ({ id } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const images = await prisma.generatedImage.findMany({
      where: { taskId: id }
    })

    for (const img of images) {
      try {
        await fs.access(img.path)
        await fs.unlink(img.path)
      } catch {
        // File doesn't exist or can't be accessed, continue with next file
      }
    }

    // Delete images from DB
    await prisma.generatedImage.deleteMany({
      where: { taskId: id }
    })

    // Delete task from DB
    await prisma.task.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
