import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRedisClient } from '@/lib/redis'

// 删除模型配置
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as any
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const userId = session.user.id
    const { id } = await req.json()
    
    if (!id) {
      return NextResponse.json({ error: '模型ID不能为空' }, { status: 400 })
    }
    
    const redis = await getRedisClient()
    const key = `prompt-debug:models:${userId}`
    
    // 获取现有的模型配置
    const existingModelsData = await redis.get(key)
    
    if (!existingModelsData) {
      return NextResponse.json({ error: '未找到模型配置' }, { status: 404 })
    }
    
    const existingModels = JSON.parse(existingModelsData)
    
    // 过滤掉要删除的模型
    const updatedModels = existingModels.filter((model: any) => model.id !== id)
    
    // 如果没有变化，说明没有找到要删除的模型
    if (updatedModels.length === existingModels.length) {
      return NextResponse.json({ error: '未找到指定模型' }, { status: 404 })
    }
    
    // 更新Redis中的数据
    await redis.set(key, JSON.stringify(updatedModels))
    
    return NextResponse.json({ success: true, message: '模型已删除' })
  } catch (error) {
    console.error('删除模型配置失败', error)
    return NextResponse.json({ error: '删除模型配置失败' }, { status: 500 })
  }
} 