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
      // 返回默认的空产品信息
      return NextResponse.json({
        id: '',
        systemId: params.systemId,
        overview: '',
        userPersona: [],
        architecture: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
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
    console.log('收到更新产品信息请求:', params.systemId);
    
    const session = await getServerSession(authOptions)
    if (!session) {
      console.log('未授权访问');
      return NextResponse.json({ error: '未授权访问' }, { status: 401 })
    }

    const data = await request.json()
    console.log('接收到的数据:', data);
    
    const { overview, userPersona, architecture } = data

    // 确保 architecture 数据的完整性
    const processArchitecture = (items: any[]): any[] => {
      if (!Array.isArray(items)) {
        console.error('架构数据不是数组格式');
        throw new Error('架构数据格式不正确');
      }
      
      return items.map(item => {
        if (!item.id || !item.title) {
          console.error('节点数据不完整:', item);
          throw new Error('节点数据不完整，缺少必要字段');
        }
        
        const processedItem = {
          id: item.id,
          title: item.title,
          description: item.description || '',
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
    console.log('开始处理架构数据');
    const processedArchitecture = architecture ? processArchitecture(architecture) : []
    console.log('处理后的架构数据:', processedArchitecture);

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

    console.log('开始扁平化架构数据');
    const flatArchitecture = flattenArchitecture(processedArchitecture)
    console.log('扁平化后的架构数据:', flatArchitecture);

    console.log('开始更新数据库');
    const productInfo = await prisma.productInfo.upsert({
      where: {
        systemId: params.systemId
      },
      update: {
        overview: overview || '',
        userPersona: userPersona || [],
        architecture: flatArchitecture
      },
      create: {
        systemId: params.systemId,
        overview: overview || '',
        userPersona: userPersona || [],
        architecture: flatArchitecture
      }
    })
    console.log('数据库更新成功');

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

    const response = {
      ...productInfo,
      architecture: Array.isArray(productInfo.architecture) 
        ? buildTree(productInfo.architecture as any[]) 
        : []
    };
    
    console.log('准备返回响应');
    return NextResponse.json(response)
  } catch (error) {
    console.error('更新产品信息失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新产品信息失败' },
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