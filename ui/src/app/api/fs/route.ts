import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

type FsEntry = {
  name: string
  path: string
  type: "dir"
}

function isWindows() {
  return process.platform === "win32"
}

function normalizeRequestedPath(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (isWindows()) {
    if (/^[A-Za-z]:$/.test(trimmed)) return `${trimmed}\\`
    const normalized = trimmed.replace(/\//g, "\\")
    return path.win32.normalize(normalized)
  }

  return path.posix.normalize(trimmed)
}

function isAbsolutePath(targetPath: string) {
  if (isWindows()) {
    return path.win32.isAbsolute(targetPath)
  }
  return path.posix.isAbsolute(targetPath)
}

function listRoots(): FsEntry[] {
  if (!isWindows()) {
    return [{ name: "/", path: "/", type: "dir" }]
  }

  const entries: FsEntry[] = []
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i)
    const drivePath = `${drive}:\\`
    if (fs.existsSync(drivePath)) {
      entries.push({ name: drivePath, path: drivePath, type: "dir" })
    }
  }
  return entries
}

function isDriveRoot(targetPath: string) {
  return isWindows() && /^[A-Za-z]:\\$/.test(targetPath)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const requested = searchParams.get("path")

  if (!requested) {
    return NextResponse.json({
      current: null,
      parent: null,
      entries: listRoots(),
    })
  }

  const normalized = normalizeRequestedPath(requested)
  if (!normalized || !isAbsolutePath(normalized)) {
    return NextResponse.json({ error: "路径必须是绝对路径。" }, { status: 400 })
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(normalized)
  } catch {
    return NextResponse.json({ error: "路径不存在。" }, { status: 404 })
  }

  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "路径不是目录。" }, { status: 400 })
  }

  let entries: FsEntry[] = []
  try {
    const dirents = fs.readdirSync(normalized, { withFileTypes: true })
    entries = dirents
      .filter((d) => d.isDirectory())
      .map((d) => ({
        name: d.name,
        path: path.join(normalized, d.name),
        type: "dir" as const,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return NextResponse.json({ error: "无法读取目录。" }, { status: 500 })
  }

  const parent = isDriveRoot(normalized) || normalized === "/" ? null : path.dirname(normalized)

  return NextResponse.json({
    current: normalized,
    parent,
    entries,
  })
}
