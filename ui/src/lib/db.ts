import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/^file:/, '')
    : path.join(process.cwd(), 'prisma', 'dev.db')

const databaseUrl = `file:${dbPath}`

process.env.DATABASE_URL = databaseUrl

const createPrismaClient = () => {
    const adapter = new PrismaLibSql({ url: databaseUrl })
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

prisma.$executeRaw`PRAGMA journal_mode=WAL`.catch(() => { })
prisma.$executeRaw`PRAGMA synchronous=NORMAL`.catch(() => { })
prisma.$executeRaw`PRAGMA cache_size=10000`.catch(() => { })
prisma.$executeRaw`PRAGMA temp_store=MEMORY`.catch(() => { })
