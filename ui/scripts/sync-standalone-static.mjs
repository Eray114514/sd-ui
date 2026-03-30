import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const staticSrc = join(root, ".next", "static");
const standaloneRoot = join(root, ".next", "standalone");

if (!existsSync(staticSrc) || !existsSync(standaloneRoot)) {
  console.warn("standalone static sync skipped: missing .next/static or .next/standalone");
  process.exit(0);
}

function countFiles(dir) {
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

const srcFileCount = countFiles(staticSrc);
console.log(`Source .next/static has ${srcFileCount} files`);

const staticDest = join(standaloneRoot, ".next", "static");

mkdirSync(staticDest, { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true, force: true });

const destFileCount = countFiles(staticDest);
console.log(`Destination has ${destFileCount} files`);

if (srcFileCount !== destFileCount) {
  console.error(`ERROR: File count mismatch! Source: ${srcFileCount}, Destination: ${destFileCount}`);
  process.exit(1);
}

console.log(`standalone static synced to ${staticDest}`);

const envSrc = join(root, ".env");
if (existsSync(envSrc)) {
  copyFileSync(envSrc, join(standaloneRoot, ".env"));
  console.log(`.env copied to ${standaloneRoot}`);
} else {
  console.warn("WARNING: .env file not found, skipping copy");
}
