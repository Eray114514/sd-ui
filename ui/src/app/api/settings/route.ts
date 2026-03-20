import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getDefaultImageDir, normalizeImageDir } from "@/lib/paths"
import { apiCache, cacheKeys } from "@/lib/cache"

export async function GET() {
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
}

export async function POST(req: Request) {
  const { imageDir } = await req.json()
  const normalizedDir = normalizeImageDir(imageDir || "")
  const config = await prisma.systemConfig.upsert({
    where: { id: 'default' },
    update: { imageDir: normalizedDir },
    create: { id: "default", imageDir: normalizedDir }
  })
  apiCache.invalidate(cacheKeys.settings)
  return NextResponse.json(config)
}
