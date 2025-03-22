import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const configs = await prisma.aIModelConfig.findMany()
    // 直接返回原始配置，不做字段转换
    return NextResponse.json(configs)
  } catch (error) {
    console.error('获取AI配置失败:', error)
    return NextResponse.json({ error: '获取AI配置失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const config = await request.json()
    
    // 如果是第一个配置，设置为默认
    const existingConfigs = await prisma.aIModelConfig.findMany()
    const isFirstConfig = existingConfigs.length === 0
    
    const result = await prisma.aIModelConfig.create({
      data: {
        id: config.id,
        name: config.name || '默认配置',
        model: config.model,
        baseURL: config.baseURL, 
        apiKey: config.apiKey,
        temperature: config.temperature || 0.2,
        isDefault: isFirstConfig || config.isDefault || false,
        provider: config.provider || '未知',
      },
    })
    
    // 直接返回结果，不做字段转换
    return NextResponse.json(result)
  } catch (error) {
    console.error('添加AI配置失败:', error)
    return NextResponse.json({ error: '添加AI配置失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const config = await request.json()
    
    const result = await prisma.aIModelConfig.update({
      where: { id: config.id },
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
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('更新AI配置失败:', error)
    return NextResponse.json({ error: '更新AI配置失败' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: '缺少ID参数' }, { status: 400 })
    }
    
    await prisma.aIModelConfig.delete({
      where: { id },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除AI配置失败:', error)
    return NextResponse.json({ error: '删除AI配置失败' }, { status: 500 })
  }
}

// 设置默认配置的专用接口
export async function PATCH(request: Request) {
  try {
    const config = await request.json()
    
    // 如果设置新的默认配置，先将所有配置的isDefault设为false
    if (config.isDefault) {
      await prisma.aIModelConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }
    
    const result = await prisma.aIModelConfig.update({
      where: { id: config.id },
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
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('更新AI配置失败:', error)
    return NextResponse.json({ error: '更新AI配置失败' }, { status: 500 })
  }
} 