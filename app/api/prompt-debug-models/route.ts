import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRedisClient } from '@/lib/redis'
import { encrypt } from '@/lib/utils/encryption-utils'

// 获取所有模型配置
export async function GET() {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const userId = session.user.id
    const redis = await getRedisClient()
    const key = `prompt-debug:models:${userId}`
    
    // 从Redis获取数据
    const modelsData = await redis.get(key)
    const models = modelsData ? JSON.parse(modelsData) : []
    
    return NextResponse.json({ models })
  } catch (error) {
    console.error('获取模型配置失败', error)
    return NextResponse.json({ error: '获取模型配置失败', models: [] }, { status: 500 })
  }
}

// 添加或更新模型配置
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const userId = session.user.id
    const { model } = await req.json()
    
    if (!model || !model.id || !model.name || !model.model || !model.baseURL || !model.apiKey) {
      return NextResponse.json({ error: '模型配置不完整' }, { status: 400 })
    }
    
    // 加密API密钥
    try {
      const encryptedModel = {
        ...model,
        apiKey: await encrypt(model.apiKey),
        _encrypted: true // 标记已加密
      }
      
      const redis = await getRedisClient()
      const key = `prompt-debug:models:${userId}`
      
      // 获取现有的模型配置
      const existingModelsData = await redis.get(key)
      const existingModels = existingModelsData ? JSON.parse(existingModelsData) : []
      
      // 检查是否是更新现有模型
      const modelIndex = existingModels.findIndex((m: any) => m.id === model.id)
      
      if (modelIndex >= 0) {
        // 更新现有模型
        existingModels[modelIndex] = encryptedModel
      } else {
        // 添加新模型
        existingModels.push(encryptedModel)
      }
      
      // 存储到Redis
      await redis.set(key, JSON.stringify(existingModels))
      
      return NextResponse.json({ success: true, message: '模型配置已保存' })
    } catch (encryptError) {
      console.error('API密钥加密失败', encryptError)
      return NextResponse.json({ error: 'API密钥加密失败' }, { status: 500 })
    }
  } catch (error) {
    console.error('保存模型配置失败', error)
    return NextResponse.json({ error: '保存模型配置失败' }, { status: 500 })
  }
} 