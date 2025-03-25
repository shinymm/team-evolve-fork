import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const redis = getRedisClient()
    
    // 获取所有ai:config:*的key（除了default）
    const keys = await redis.keys('ai:config:*')
    const configKeys = keys.filter(key => !key.endsWith(':default'))
    
    if (configKeys.length > 0) {
      // 获取所有配置
      const configs = await redis.mget(...configKeys)
      const models = configs
        .map((config) => {
          if (!config) return null
          // 直接返回完整的配置信息
          return JSON.parse(config)
        })
        .filter(Boolean)
        
      return NextResponse.json({ models })
    }

    // Redis没有配置时，从数据库获取
    const dbModels = await prisma.aIModelConfig.findMany({
      select: {
        id: true,
        name: true,
        model: true,
        baseURL: true,
        apiKey: true,
        temperature: true,
        isDefault: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ models: dbModels })
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    )
  }
} 