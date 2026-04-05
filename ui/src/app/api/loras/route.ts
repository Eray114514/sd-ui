import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiCache } from '@/lib/cache'

export async function GET() {
  const cached = apiCache.get('loras')
  if (cached) {
    return NextResponse.json(cached)
  }

  const loras = await prisma.lora.findMany()
  apiCache.set('loras', loras)
  return NextResponse.json(loras)
}

export async function POST(req: Request) {
  let name
  try {
    ({ name } = await req.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const lora = await prisma.lora.create({ data: { name } })
    apiCache.invalidate('loras')
    return NextResponse.json(lora)
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
    await prisma.lora.delete({ where: { id } })
    apiCache.invalidate('loras')
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
