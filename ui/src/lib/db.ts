import { PrismaClient } from '@prisma/client'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// 构建数据库绝对路径，避免 Prisma 相对路径解析问题
const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/^file:/, '')
    : path.join(process.cwd(), 'prisma', 'dev.db')

const databaseUrl = `file:${dbPath}`

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl
        }
    }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

prisma.$executeRaw`PRAGMA journal_mode=WAL`.catch(() => { })
prisma.$executeRaw`PRAGMA synchronous=NORMAL`.catch(() => { })
prisma.$executeRaw`PRAGMA cache_size=10000`.catch(() => { })
prisma.$executeRaw`PRAGMA temp_store=MEMORY`.catch(() => { })
