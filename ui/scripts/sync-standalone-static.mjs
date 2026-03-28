import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const staticSrc = join(root, ".next", "static");
const standaloneRoot = join(root, ".next", "standalone");

if (!existsSync(staticSrc) || !existsSync(standaloneRoot)) {
  console.warn("standalone static sync skipped: missing .next/static or .next/standalone");
  process.exit(0);
}

let appDir = null;
try {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (pkg?.name && existsSync(join(standaloneRoot, pkg.name))) {
    appDir = pkg.name;
  }
} catch {
  // Ignore and fall back to directory scan.
}

if (!appDir) {
  const dirs = readdirSync(standaloneRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next")
    .map((entry) => entry.name);
  if (dirs.length === 1) {
    appDir = dirs[0];
  } else if (dirs.length > 1) {
    appDir = dirs.find((name) => name === "ui") ?? dirs[0];
  }
}

if (!appDir) {
  console.warn("standalone static sync skipped: unable to resolve standalone app directory");
  process.exit(0);
}

const staticDest = join(standaloneRoot, appDir, ".next", "static");
mkdirSync(staticDest, { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true, force: true });
console.log(`standalone static synced to ${staticDest}`);
