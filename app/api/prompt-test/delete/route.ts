import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

export async function POST(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json(
        { error: '缺少测试数据集ID' },
        { status: 400 }
      )
    }

    const redis = getRedisClient()
    await redis.del(`prompt:test:${id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除测试数据集失败:', error)
    return NextResponse.json(
      { error: '删除测试数据集失败' },
      { status: 500 }
    )
  }
} 