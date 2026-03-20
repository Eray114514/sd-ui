import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiCache, cacheKeys } from '@/lib/cache'

export async function GET() {
  const cached = apiCache.get(cacheKeys.models)
  if (cached) {
    return NextResponse.json(cached)
  }

  const models = await prisma.sdModel.findMany()
  apiCache.set(cacheKeys.models, models)
  return NextResponse.json(models)
}

export async function POST(req: Request) {
  const { name } = await req.json()
  const model = await prisma.sdModel.create({ data: { name } })
  apiCache.invalidate(cacheKeys.models)
  return NextResponse.json(model)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  await prisma.sdModel.delete({ where: { id } })
  apiCache.invalidate(cacheKeys.models)
  return NextResponse.json({ success: true })
}
