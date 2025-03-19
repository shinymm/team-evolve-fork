import { PrismaClient } from '@prisma/client'
import { Pool, PoolConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

declare global {
  var prisma: PrismaClient | undefined
}

const poolConfig: PoolConfig & { webSocketConstructor: typeof ws } = {
  connectionString: process.env.DATABASE_URL!,
  webSocketConstructor: ws,
}

const pool = new Pool(poolConfig)
const adapter = new PrismaNeon(pool)

const prismaClientSingleton = () => {
  return new PrismaClient({
    // @ts-ignore - Prisma doesn't recognize the adapter property but it works
    adapter,
    log: ['query', 'error', 'warn'],
  })
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export { prisma } 