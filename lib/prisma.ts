import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
})

// 添加错误处理
prisma.$on('error', (e: Error) => {
  console.error('Prisma错误:', e)
})

// 添加查询日志
prisma.$on('query', (e: { query: string; params: string; duration: number; target: string }) => {
  console.log('Prisma查询:', e)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 