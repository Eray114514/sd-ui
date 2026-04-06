import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const cwd = path.join(__dirname, '..');
  
  try {
    // 尝试直接跑 deploy，如果数据库为空或者 0_init 未冲突，它会成功
    // 如果 0_init 已经应用，它也会直接成功
    execSync('npx prisma migrate deploy', { stdio: 'pipe', cwd });
    console.log('[Auto-Resolve] Migrate deploy succeeded. No need to resolve.');
  } catch (error) {
    const output = error.stdout?.toString() + error.stderr?.toString();
    console.log('[Auto-Resolve] Migrate deploy failed. Output:', output);
    
    // 如果是因为数据库不为空（表已存在）导致的冲突 (P3005)，则强制标记 0_init 为已应用
    if (output && (output.includes('P3005') || output.includes('already exists'))) {
      console.log('[Auto-Resolve] Database not empty, resolving 0_init...');
      try {
        execSync('npx prisma migrate resolve --applied 0_init', { stdio: 'inherit', cwd });
        console.log('[Auto-Resolve] Successfully marked 0_init as applied.');
      } catch (resolveError) {
        console.error('[Auto-Resolve] Error resolving 0_init:', resolveError.message);
      }
    } else {
      console.error('[Auto-Resolve] Unknown migration error. Exiting.');
      process.exit(1);
    }
  }
}

main();
