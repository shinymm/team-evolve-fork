import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export async function POST() {
  try {
    const redis = getRedisClient()
    
    // 获取所有匹配的键
    const keys = await redis.keys('prompt:test:*')
    
    if (keys.length > 0) {
      // 删除所有匹配的键
      await redis.del(keys)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('清空测试数据集缓存失败:', error)
    return NextResponse.json(
      { error: '清空测试数据集缓存失败' },
      { status: 500 }
    )
  }
} 