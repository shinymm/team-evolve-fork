import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 获取系统架构
export async function GET(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { systemId } = params
    const architecture = await prisma.architecture.findUnique({
      where: { systemId }
    })

    if (!architecture) {
      return NextResponse.json({
        id: '',
        systemId,
        highLevel: '',
        microservice: '',
        deployment: '',
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }

    return NextResponse.json(architecture)
  } catch (error) {
    console.error('获取系统架构失败:', error)
    return NextResponse.json(
      { error: '获取系统架构失败' },
      { status: 500 }
    )
  }
}

// 创建或更新系统架构
export async function PUT(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { systemId } = params
    const json = await request.json()
    
    // 获取要更新的字段和内容
    const { type, content } = json
    if (!type || !content || !['highLevel', 'microservice', 'deployment'].includes(type)) {
      return NextResponse.json(
        { error: '无效的架构类型或内容' },
        { status: 400 }
      )
    }

    // 使用upsert确保创建或更新
    const architecture = await prisma.architecture.upsert({
      where: { systemId },
      update: {
        [type]: content
      },
      create: {
        systemId,
        highLevel: type === 'highLevel' ? content : '',
        microservice: type === 'microservice' ? content : '',
        deployment: type === 'deployment' ? content : ''
      }
    })

    return NextResponse.json(architecture)
  } catch (error) {
    console.error('更新系统架构失败:', error)
    return NextResponse.json(
      { error: '更新系统架构失败' },
      { status: 500 }
    )
  }
}

// 删除系统架构
export async function DELETE(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { systemId } = params
    await prisma.architecture.delete({
      where: { systemId }
    })

    return NextResponse.json({ message: '系统架构删除成功' })
  } catch (error) {
    console.error('删除系统架构失败:', error)
    return NextResponse.json(
      { error: '删除系统架构失败' },
      { status: 500 }
    )
  }
} 