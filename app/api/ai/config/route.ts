import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/utils/encryption-utils'

const redis = getRedisClient()

type AIConfig = {
  id: string
  name: string
  provider: string | null
  apiKey: string | null
  baseURL: string | null
  isDefault: boolean
  createdAt: Date
}

export async function GET() {
  try {
    // 首先尝试从 Redis 获取配置
    const configKeys = await redis.keys('ai:config:*')
    const validKeys = configKeys.filter((key: string) => !key.endsWith(':default'))

    if (validKeys.length > 0) {
      const configs = await redis.mget(...validKeys)
      const parsedConfigs = configs
        .filter((config): config is string => config !== null)
        .map((config: string) => {
          const parsed = JSON.parse(config)
          if (parsed.apiKey) {
            parsed.apiKey = decrypt(parsed.apiKey)
          }
          return parsed
        })

      // 异步更新 Redis 中的配置
      prisma.aIModelConfig.findMany({
        select: {
          id: true,
          name: true,
          provider: true,
          apiKey: true,
          baseURL: true,
          isDefault: true,
          createdAt: true
        },
        orderBy: {
          name: 'asc'
        }
      }).then(async (dbConfigs: AIConfig[]) => {
        // 更新 Redis 中的配置
        const pipeline = redis.pipeline()
        for (const config of dbConfigs) {
          pipeline.set(`ai:config:${config.id}`, JSON.stringify(config))
          if (config.isDefault) {
            pipeline.set('ai:config:default', JSON.stringify(config))
          }
        }
        await pipeline.exec()
      }).catch((error: Error) => {
        console.error('同步 AI 配置到 Redis 时出错:', error)
      })

      return NextResponse.json(parsedConfigs)
    }

    // 如果 Redis 中没有数据，从数据库获取
    const dbConfigs = await prisma.aIModelConfig.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        apiKey: true,
        baseURL: true,
        isDefault: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // 异步更新 Redis
    const pipeline = redis.pipeline()
    for (const config of dbConfigs) {
      pipeline.set(`ai:config:${config.id}`, JSON.stringify(config))
      if (config.isDefault) {
        pipeline.set('ai:config:default', JSON.stringify(config))
      }
    }
    await pipeline.exec()

    return NextResponse.json(dbConfigs)
  } catch (error) {
    console.error('获取 AI 配置失败:', error)
    return NextResponse.json(
      { error: '获取 AI 配置失败' },
      { status: 500 }
    )
  }
} 