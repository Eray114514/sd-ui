export const dynamic = "force-dynamic"
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiCache, cacheKeys } from '@/lib/cache'

export async function GET() {
  const cached = apiCache.get(cacheKeys.models)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    const models = await prisma.sdModel.findMany()
    apiCache.set(cacheKeys.models, models)
    return NextResponse.json(models)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let name
  try {
    ({ name } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const model = await prisma.sdModel.create({ data: { name } })
    apiCache.invalidate(cacheKeys.models)
    return NextResponse.json(model)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  let id
  try {
    ({ id } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    await prisma.sdModel.delete({ where: { id } })
    apiCache.invalidate(cacheKeys.models)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
