import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'

// 保存测试数据集
export async function POST(request: Request) {
  try {
    const redis = getRedisClient()
    const data = await request.json()
    
    const timestamp = Date.now().toString()
    const testData = {
      id: timestamp,
      prompt: data.prompt,
      parameters: data.parameters,
      description: data.description,
      createdAt: new Date().toISOString()
    }
    
    await redis.set(`prompt:test:${timestamp}`, JSON.stringify(testData))
    return NextResponse.json({ success: true, id: timestamp })
  } catch (error) {
    console.error('保存测试数据集失败:', error)
    return NextResponse.json(
      { error: '保存测试数据集失败' },
      { status: 500 }
    )
  }
}

// 获取所有测试数据集
export async function GET() {
  try {
    const redis = getRedisClient()
    const keys = await redis.keys('prompt:test:*')
    
    if (keys.length === 0) {
      return NextResponse.json({ tests: [] })
    }
    
    const tests = await redis.mget(...keys)
    const parsedTests = tests
      .map(test => {
        if (!test) return null
        const parsed = JSON.parse(test)
        if (!parsed.description) {
          parsed.description = '未命名测试'
        }
        return parsed
      })
      .filter(Boolean)
      .sort((a, b) => b.id.localeCompare(a.id)) // 按时间戳倒序
    
    return NextResponse.json({ tests: parsedTests })
  } catch (error) {
    console.error('获取测试数据集失败:', error)
    return NextResponse.json(
      { error: '获取测试数据集失败' },
      { status: 500 }
    )
  }
} 