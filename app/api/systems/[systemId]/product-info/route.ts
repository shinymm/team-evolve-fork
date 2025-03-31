import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// 获取产品信息
export async function GET(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const productInfo = await prisma.productInfo.findUnique({
      where: {
        systemId: params.systemId
      }
    })

    if (!productInfo) {
      return NextResponse.json({ error: '未找到产品信息' }, { status: 404 })
    }

    return NextResponse.json(productInfo)
  } catch (error) {
    console.error('获取产品信息失败:', error)
    return NextResponse.json(
      { error: '获取产品信息失败' },
      { status: 500 }
    )
  }
}

// 更新产品信息
export async function PUT(
  request: Request,
  { params }: { params: { systemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const data = await request.json()
    const { overview, userPersona, architecture } = data

    // 确保 architecture 数据的完整性
    const processArchitecture = (items: any[]): any[] => {
      return items.map(item => {
        const processedItem = {
          id: item.id,
          title: item.title,
          description: item.description,
          parentId: item.parentId
        }
        
        // 如果有 children，递归处理，同时确保子项的 parentId
        if (item.children && Array.isArray(item.children)) {
          const children = item.children.map((child: any) => ({
            ...child,
            parentId: item.id // 确保子项有正确的 parentId
          }))
          return { ...processedItem, children }
        }
        
        return processedItem
      })
    }

    // 处理 architecture 数据
    const processedArchitecture = architecture ? processArchitecture(architecture) : []

    // 将树状结构扁平化以存储到数据库
    const flattenArchitecture = (items: any[]): any[] => {
      const result: any[] = []
      const flatten = (item: any) => {
        const { children, ...itemWithoutChildren } = item
        result.push(itemWithoutChildren)
        if (children && Array.isArray(children)) {
          children.forEach(flatten)
        }
      }
      items.forEach(flatten)
      return result
    }

    const flatArchitecture = flattenArchitecture(processedArchitecture)

    const productInfo = await prisma.productInfo.upsert({
      where: {
        systemId: params.systemId
      },
      update: {
        overview,
        userPersona,
        architecture: flatArchitecture
      },
      create: {
        systemId: params.systemId,
        overview,
        userPersona,
        architecture: flatArchitecture
      }
    })

    // 在返回给前端之前，重建树状结构
    const buildTree = (items: any[]): any[] => {
      const itemMap = new Map()
      const rootItems: any[] = []

      // 首先创建所有节点的映射
      items.forEach(item => {
        itemMap.set(item.id, { ...item, children: [] })
      })

      // 构建树状结构
      items.forEach(item => {
        if (item.parentId && itemMap.has(item.parentId)) {
          const parent = itemMap.get(item.parentId)
          parent.children.push(itemMap.get(item.id))
        } else {
          rootItems.push(itemMap.get(item.id))
        }
      })

      return rootItems
    }

    // 返回重建后的树状结构
    return NextResponse.json({
      ...productInfo,
      architecture: Array.isArray(productInfo.architecture) 
        ? buildTree(productInfo.architecture as any[]) 
        : []
    })
  } catch (error) {
    console.error('更新产品信息失败:', error)
    return NextResponse.json(
      { error: '更新产品信息失败' },
      { status: 500 }
    )
  }
}

// 删除产品信息
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
    await prisma.productInfo.delete({
      where: { systemId }
    })

    return NextResponse.json({ message: '产品信息删除成功' })
  } catch (error) {
    console.error('删除产品信息失败:', error)
    return NextResponse.json(
      { error: '删除产品信息失败' },
      { status: 500 }
    )
  }
} 