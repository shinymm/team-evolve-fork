import { PrismaClient } from '@prisma/client'
import { Pool } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import ws from 'ws'

declare global {
  var prisma: PrismaClient | undefined
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  webSocketConstructor: ws,
  max: 1,
}

const pool = new Pool(poolConfig)
const adapter = new PrismaNeon(pool)

export const prisma = globalThis.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
} 