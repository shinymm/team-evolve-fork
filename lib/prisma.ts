import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 创建PrismaClient实例
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: [
    {
      emit: 'stdout',
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

// 测试数据库连接
export async function testDatabaseConnection() {
  try {
    // 简单查询测试连接
    const result = await prisma.$queryRaw`SELECT 1 as check`
    console.log('数据库连接测试成功:', result)
    return true
  } catch (error) {
    console.error('数据库连接测试失败:', error)
    return false
  }
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} 