import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const config = await prisma.aIModelConfig.findUnique({
      where: { id }
    })

    if (!config) {
      return NextResponse.json({ error: '未找到配置' }, { status: 404 })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('获取AI配置失败:', error)
    return NextResponse.json({ error: '获取AI配置失败' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const config = await request.json()
    
    const existingConfig = await prisma.aIModelConfig.findUnique({
      where: { id }
    })
    
    if (!existingConfig) {
      return NextResponse.json({ error: '未找到配置' }, { status: 404 })
    }
    
    const result = await prisma.aIModelConfig.update({
      where: { id },
      data: {
        name: config.name,
        model: config.model,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        temperature: config.temperature,
        isDefault: config.isDefault,
        provider: config.provider,
      },
    })
    
    // 如果设置了新的默认配置，则更新其他配置
    if (config.isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { 
          id: { not: id },
          isDefault: true 
        },
        data: { isDefault: false },
      })
    }
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('更新AI配置失败:', error)
    return NextResponse.json({ error: '更新AI配置失败' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    const existingConfig = await prisma.aIModelConfig.findUnique({
      where: { id }
    })
    
    if (!existingConfig) {
      return NextResponse.json({ error: '未找到配置' }, { status: 404 })
    }
    
    await prisma.aIModelConfig.delete({
      where: { id },
    })
    
    // 如果删除的是默认配置，则将另一个配置设为默认
    if (existingConfig.isDefault) {
      const anotherConfig = await prisma.aIModelConfig.findFirst({
        where: { id: { not: id } }
      })
      
      if (anotherConfig) {
        await prisma.aIModelConfig.update({
          where: { id: anotherConfig.id },
          data: { isDefault: true }
        })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除AI配置失败:', error)
    return NextResponse.json({ error: '删除AI配置失败' }, { status: 500 })
  }
} 