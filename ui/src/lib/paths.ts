import os from "os"
import path from "path"

function expandHome(input: string) {
  if (input === "~") return os.homedir()
  if (input.startsWith("~/") || input.startsWith("~\\")) {
    return path.join(os.homedir(), input.slice(2))
  }
  return input
}

function expandEnvVars(input: string) {
  let output = input
  output = output.replace(/%([^%]+)%/g, (_, name) => {
    const value = process.env[name]
    return value ? value : `%${name}%`
  })
  output = output.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    const value = process.env[name]
    return value ? value : `$${name}`
  })
  return output
}

export function getDefaultImageDir() {
  return path.join(os.homedir(), "ai_images")
}

export function normalizeImageDir(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return getDefaultImageDir()
  const expanded = expandEnvVars(expandHome(trimmed))
  const resolved = path.isAbsolute(expanded) ? expanded : path.resolve(expanded)
  return path.normalize(resolved)
}
