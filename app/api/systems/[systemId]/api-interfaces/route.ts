import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 获取系统的所有API接口
export async function GET(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  const { systemId } = params;

  if (!systemId) {
    return NextResponse.json({ error: 'System ID is required' }, { status: 400 });
  }

  try {
    const apiInterfaces = await prisma.aPIInterface.findMany({
      where: {
        systemId: systemId,
      },
      orderBy: {
        createdAt: 'desc', // 或者根据需要排序
      },
    });

    // 注意：这里没有获取订阅信息，因为数据库模型中没有定义
    // 如果需要订阅信息，需要先扩展 Prisma schema 并实现相关逻辑

    return NextResponse.json(apiInterfaces);
  } catch (error) {
    console.error('Failed to fetch API interfaces:', error);
    // 根据错误类型返回更具体的错误信息可能更好
    if (error instanceof Error) {
        return NextResponse.json({ error: `Failed to fetch API interfaces: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
  }
}

// 创建新的API接口
export async function POST(
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
    const { 
      name, 
      description, 
      type, 
      endpoint, 
      operation,
      swaggerEndpoint,
      swaggerDoc 
    } = json

    const apiInterface = await prisma.aPIInterface.create({
      data: {
        systemId,
        name,
        description,
        type,
        endpoint,
        operation,
        swaggerEndpoint,
        swaggerDoc
      }
    })

    return NextResponse.json(apiInterface)
  } catch (error) {
    console.error('创建API接口失败:', error)
    return NextResponse.json(
      { error: '创建API接口失败' },
      { status: 500 }
    )
  }
}

// 更新API接口
export async function PUT(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const json = await request.json()
    const { 
      id,
      name, 
      description, 
      type, 
      endpoint, 
      operation,
      swaggerEndpoint,
      swaggerDoc 
    } = json

    if (!id) {
      return NextResponse.json(
        { error: 'API接口ID不能为空' },
        { status: 400 }
      )
    }

    const apiInterface = await prisma.aPIInterface.update({
      where: { id },
      data: {
        name,
        description,
        type,
        endpoint,
        operation,
        swaggerEndpoint,
        swaggerDoc
      }
    })

    return NextResponse.json(apiInterface)
  } catch (error) {
    console.error('更新API接口失败:', error)
    return NextResponse.json(
      { error: '更新API接口失败' },
      { status: 500 }
    )
  }
}

// 删除API接口
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'API接口ID不能为空' },
        { status: 400 }
      )
    }

    await prisma.aPIInterface.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'API接口删除成功' })
  } catch (error) {
    console.error('删除API接口失败:', error)
    return NextResponse.json(
      { error: '删除API接口失败' },
      { status: 500 }
    )
  }
} 