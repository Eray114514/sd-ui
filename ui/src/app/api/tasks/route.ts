import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import fs from 'fs'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' }
    ],
    take: 50,
    include: { images: true }
  })
  return NextResponse.json(tasks)
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    
    // Get all images for this task
    const images = await prisma.generatedImage.findMany({
      where: { taskId: id }
    })

    // Delete files from disk
    for (const img of images) {
      if (fs.existsSync(img.path)) {
        fs.unlinkSync(img.path)
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
