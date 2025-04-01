import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 获取单个系统
export async function GET(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const system = await prisma.system.findUnique({
      where: { id: params.systemId }
    })

    if (!system) {
      return NextResponse.json(
        { error: '系统不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(system)
  } catch (error) {
    console.error('获取系统失败:', error)
    return NextResponse.json(
      { error: '获取系统失败' },
      { status: 500 }
    )
  }
}

// 更新系统
export async function PATCH(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const json = await request.json()
    const { description } = json

    // 检查系统是否存在
    const existingSystem = await prisma.system.findUnique({
      where: { id: params.systemId }
    })

    if (!existingSystem) {
      return NextResponse.json(
        { error: '系统不存在' },
        { status: 404 }
      )
    }

    // 更新系统
    const system = await prisma.system.update({
      where: { id: params.systemId },
      data: {
        description,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(system)
  } catch (error) {
    console.error('更新系统失败:', error)
    return NextResponse.json(
      { error: '更新系统失败' },
      { status: 500 }
    )
  }
}

// 删除系统
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
    await prisma.system.delete({
      where: { id: systemId }
    })

    return NextResponse.json({ message: '系统删除成功' })
  } catch (error) {
    console.error('删除系统失败:', error)
    return NextResponse.json(
      { error: '删除系统失败' },
      { status: 500 }
    )
  }
} 