import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiCache, cacheKeys } from '@/lib/cache'
import { ASSETS_PAGE_SIZE } from '@/lib/constants'
import fs from 'fs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const page = parseInt(searchParams.get('page') || '0', 10)

  if (!cursor && page === 0) {
    const cached = apiCache.get(cacheKeys.assets())
    if (cached) {
      return NextResponse.json(cached)
    }
  }

  const images = await prisma.generatedImage.findMany({
    take: ASSETS_PAGE_SIZE,
    skip: cursor ? 1 : (page > 0 ? page * ASSETS_PAGE_SIZE : 0),
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    include: {
      task: true
    }
  })

  if (!cursor && page === 0) {
    apiCache.set(cacheKeys.assets(), images)
  }

  return NextResponse.json(images)
}

export async function DELETE(req: Request) {
  let id
  try {
    ({ id } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const image = await prisma.generatedImage.findUnique({ where: { id } })

    if (image && fs.existsSync(image.path)) {
      fs.unlinkSync(image.path)
    }

    await prisma.generatedImage.delete({
      where: { id }
    })

    apiCache.invalidate(cacheKeys.assets())
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  let id, isFavorite
  try {
    ({ id, isFavorite } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const image = await prisma.generatedImage.update({
      where: { id },
      data: { isFavorite }
    })
    apiCache.invalidate(cacheKeys.assets())
    return NextResponse.json(image)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
