import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiCache, cacheKeys } from '@/lib/cache'

const DEFAULT_STYLES = [
  "Lasy",
  "NAI3起手-"
]

export async function GET() {
  const cached = apiCache.get(cacheKeys.styles)
  if (cached) {
    return NextResponse.json(cached)
  }

  let styles = await prisma.style.findMany()

  if (styles.length === 0) {
    for (const styleName of DEFAULT_STYLES) {
      await prisma.style.create({ data: { name: styleName } })
    }
    styles = await prisma.style.findMany()
  }

  apiCache.set(cacheKeys.styles, styles)
  return NextResponse.json(styles)
}

export async function POST(req: Request) {
  let name
  try {
    ({ name } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const style = await prisma.style.create({ data: { name } })
    apiCache.invalidate(cacheKeys.styles)
    return NextResponse.json(style)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
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
    await prisma.style.delete({ where: { id } })
    apiCache.invalidate(cacheKeys.styles)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
