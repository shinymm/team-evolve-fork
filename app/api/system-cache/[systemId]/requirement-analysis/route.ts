import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient, getRedisValue, setRedisValue } from '@/lib/redis'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 定义Redis键名前缀
const REDIS_KEY_PREFIX = 'system:data:'

/**
 * 获取系统需求分析缓存数据
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  try {
    // 验证身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { systemId } = params
    if (!systemId) {
      return NextResponse.json({ error: '缺少系统ID' }, { status: 400 })
    }

    // 构建Redis键名 - 加入用户ID实现数据隔离
    const userId = session.user.id
    const redisKey = `${REDIS_KEY_PREFIX}${userId}:${systemId}:requirement-analysis`

    // 从Redis获取数据
    const redisClient = getRedisClient()
    const data = await redisClient.get(redisKey)

    // 如果Redis中没有数据，返回404
    if (!data) {
      return NextResponse.json({ message: '找不到系统缓存数据' }, { status: 404 })
    }

    try {
      // 尝试解析JSON数据
      const parsedData = JSON.parse(data)
      return NextResponse.json({
        systemState: parsedData,
        message: '成功获取系统缓存数据'
      })
    } catch (error) {
      console.error('解析Redis数据失败:', error)
      return NextResponse.json({ error: 'Redis数据格式错误' }, { status: 500 })
    }
  } catch (error) {
    console.error('获取系统缓存数据失败:', error)
    return NextResponse.json(
      { error: '获取系统缓存数据失败' },
      { status: 500 }
    )
  }
}

/**
 * 保存系统需求分析缓存数据
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  try {
    // 验证身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { systemId } = params
    if (!systemId) {
      return NextResponse.json({ error: '缺少系统ID' }, { status: 400 })
    }

    // 获取请求体
    const body = await request.json()
    const { systemState } = body

    if (!systemState) {
      return NextResponse.json({ error: '缺少系统状态数据' }, { status: 400 })
    }

    // 构建Redis键名 - 加入用户ID实现数据隔离
    const userId = session.user.id
    const redisKey = `${REDIS_KEY_PREFIX}${userId}:${systemId}:requirement-analysis`

    // 序列化数据
    const serializedData = JSON.stringify(systemState)

    // 保存到Redis (30天过期)
    const redisClient = getRedisClient()
    await redisClient.set(redisKey, serializedData, 'EX', 60 * 60 * 24 * 30)

    return NextResponse.json({
      message: '成功保存系统缓存数据'
    })
  } catch (error) {
    console.error('保存系统缓存数据失败:', error)
    return NextResponse.json(
      { error: '保存系统缓存数据失败' },
      { status: 500 }
    )
  }
}

/**
 * 删除系统需求分析缓存数据
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { systemId: string } }
) {
  try {
    // 验证身份
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { systemId } = params
    if (!systemId) {
      return NextResponse.json({ error: '缺少系统ID' }, { status: 400 })
    }

    // 构建Redis键名 - 加入用户ID实现数据隔离
    const userId = session.user.id
    const redisKey = `${REDIS_KEY_PREFIX}${userId}:${systemId}:requirement-analysis`

    // 从Redis删除数据
    const redisClient = getRedisClient()
    const result = await redisClient.del(redisKey)

    return NextResponse.json({
      message: result > 0 ? '成功删除系统缓存数据' : '系统缓存数据不存在',
      deleted: result > 0
    })
  } catch (error) {
    console.error('删除系统缓存数据失败:', error)
    return NextResponse.json(
      { error: '删除系统缓存数据失败' },
      { status: 500 }
    )
  }
} 