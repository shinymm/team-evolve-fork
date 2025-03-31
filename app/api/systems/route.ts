import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// 获取系统列表
export async function GET() {
  try {
    console.log('收到获取系统列表请求')
    const session = await getServerSession(authOptions)
    // console.log('当前会话状态:', {
    //   isAuthenticated: !!session,
    //   user: session?.user
    // })
    
    if (!session) {
      console.log('未授权访问')
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    console.log('开始查询系统列表')
    // 首先检查数据库连接
    try {
      await prisma.$connect()
      console.log('数据库连接成功')
    } catch (dbError) {
      console.error('数据库连接失败:', dbError)
      return NextResponse.json(
        { error: '数据库连接失败' },
        { status: 500 }
      )
    }

    // 查询系统总数
    const totalCount = await prisma.system.count()
    console.log('系统总数:', totalCount)

    const systems = await prisma.system.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true
      }
    })
    
    console.log('查询结果:', {
      count: systems.length,
      systems: systems.map((s: {
        id: string;
        name: string;
        status?: string;
      }) => ({
        id: s.id,
        name: s.name,
        status: s.status
      }))
    })

    if (systems.length === 0) {
      console.log('未找到任何系统')
      return NextResponse.json([]) // 返回空数组而不是错误
    }

    return NextResponse.json(systems)
  } catch (error) {
    console.error('获取系统列表失败:', error)
    // 返回更详细的错误信息
    return NextResponse.json(
      { 
        error: '获取系统列表失败',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  } finally {
    // 确保断开数据库连接
    await prisma.$disconnect()
  }
}

// 创建新系统
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const json = await request.json()
    const { name, description } = json

    if (!name) {
      return NextResponse.json(
        { error: '系统名称不能为空' },
        { status: 400 }
      )
    }

    const system = await prisma.system.create({
      data: {
        name,
        description,
        createdBy: session.user.email
      }
    })

    return NextResponse.json(system)
  } catch (error) {
    console.error('创建系统失败:', error)
    return NextResponse.json(
      { error: '创建系统失败' },
      { status: 500 }
    )
  }
} 