import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/utils/encryption-utils'

// 获取所有配置
export async function GET() {
  try {
    const configs = await prisma.vectorModelConfig.findMany()
    
    // 直接返回配置，保持API密钥加密状态
    return NextResponse.json(configs)
  } catch (error) {
    console.error('获取向量配置失败:', error)
    return NextResponse.json(
      { error: '获取向量配置失败' },
      { status: 500 }
    )
  }
}

// 添加新配置
export async function POST(request: Request) {
  try {
    const config = await request.json()
    
    // 检查API密钥是否已加密
    const apiKey = config.apiKey.length > 100 ? config.apiKey : await encrypt(config.apiKey)
    
    // 如果是默认配置，先将其他配置设为非默认
    if (config.isDefault) {
      await prisma.vectorModelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }
    
    // 创建新配置
    const savedConfig = await prisma.vectorModelConfig.create({
      data: {
        id: config.id,
        name: config.name,
        model: config.model,
        baseURL: config.baseURL,
        apiKey: apiKey,
        dimension: config.dimension,
        isDefault: config.isDefault || false,
        provider: config.provider || null,
      }
    })
    
    // 返回配置，保持API密钥加密状态
    return NextResponse.json(savedConfig)
  } catch (error) {
    console.error('添加向量配置失败:', error)
    return NextResponse.json(
      { error: '添加向量配置失败' },
      { status: 500 }
    )
  }
}

// 删除配置
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: '缺少配置ID' },
        { status: 400 }
      )
    }
    
    // 获取要删除的配置
    const configToDelete = await prisma.vectorModelConfig.findUnique({
      where: { id }
    })
    
    if (!configToDelete) {
      return NextResponse.json(
        { error: '配置不存在' },
        { status: 404 }
      )
    }
    
    const wasDefault = configToDelete.isDefault
    
    // 如果是默认配置，先找到新的默认配置
    if (wasDefault) {
      const newDefault = await prisma.vectorModelConfig.findFirst({
        where: { 
          id: { not: id }
        },
        orderBy: { createdAt: 'desc' }
      })
      
      if (newDefault) {
        await prisma.vectorModelConfig.update({
          where: { id: newDefault.id },
          data: { isDefault: true }
        })
      }
    }
    
    // 删除配置
    await prisma.vectorModelConfig.delete({
      where: { id }
    })
    
    console.log(`向量配置已删除 (ID: ${id}), 是否为默认配置: ${wasDefault}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除向量配置失败:', error)
    return NextResponse.json(
      { error: '删除向量配置失败' },
      { status: 500 }
    )
  }
} 