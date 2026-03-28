import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
        db: {
            url: (process.env.DATABASE_URL || "file:./prisma/dev.db") + "?connection_limit=5&pool_timeout=10"
        }
    }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

prisma.$executeRaw`PRAGMA journal_mode=WAL`.catch(() => {})
prisma.$executeRaw`PRAGMA synchronous=NORMAL`.catch(() => {})
prisma.$executeRaw`PRAGMA cache_size=10000`.catch(() => {})
prisma.$executeRaw`PRAGMA temp_store=MEMORY`.catch(() => {})
