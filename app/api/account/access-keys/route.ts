import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserAccessKeyService } from '@/lib/services/user-access-key-service'

// 获取特定平台的访问密钥
export async function GET(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')

    if (!platform) {
      return NextResponse.json({ error: '缺少平台参数' }, { status: 400 })
    }

    // 获取密钥
    const accessKey = await UserAccessKeyService.getUserAccessKey(
      session.user.id,
      platform as any  // 临时类型断言
    )

    if (!accessKey) {
      return NextResponse.json({ message: '未找到访问密钥' }, { status: 404 })
    }

    return NextResponse.json(accessKey)
  } catch (error) {
    console.error('获取访问密钥失败:', error)
    return NextResponse.json({ error: '获取访问密钥失败' }, { status: 500 })
  }
}

// 创建或更新访问密钥
export async function POST(request: NextRequest) {
  try {
    // 获取当前用户会话
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取请求体
    const body = await request.json()
    const { platform, accessKey } = body

    if (!platform || !accessKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }

    // 创建或更新密钥
    const result = await UserAccessKeyService.upsertUserAccessKey(
      session.user.id,
      platform as any,  // 临时类型断言
      accessKey
    )

    return NextResponse.json({
      message: '访问密钥已更新',
      id: result.id
    })
  } catch (error) {
    console.error('更新访问密钥失败:', error)
    return NextResponse.json({ error: '更新访问密钥失败' }, { status: 500 })
  }
} 