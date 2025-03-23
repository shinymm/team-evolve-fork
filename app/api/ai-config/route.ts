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

// PUT方法转移到[id]/route.ts文件中处理

// DELETE方法转移到[id]/route.ts文件中处理
// 此处的DELETE方法已废弃，请使用[id]/route.ts中的DELETE方法

// 设置默认配置的专用接口转移到[id]/default/route.ts文件中处理
// 此处的PATCH方法已废弃，请使用[id]/default/route.ts中的PATCH方法 