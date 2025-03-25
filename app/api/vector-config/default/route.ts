import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { decrypt } from '@/lib/utils/encryption-utils'

const prisma = new PrismaClient()

// 获取默认配置
export async function GET() {
  try {
    const config = await prisma.vectorModelConfig.findFirst({
      where: { isDefault: true }
    })
    
    if (!config) {
      return NextResponse.json(null)
    }
    
    // 解密API密钥
    return NextResponse.json({
      ...config,
      apiKey: await decrypt(config.apiKey)
    })
  } catch (error) {
    console.error('获取默认向量配置失败:', error)
    return NextResponse.json(
      { error: '获取默认向量配置失败' },
      { status: 500 }
    )
  }
}

// 设置默认配置
export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: '缺少配置ID' },
        { status: 400 }
      )
    }
    
    // 先将所有配置设为非默认
    await prisma.vectorModelConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false }
    })
    
    // 设置新的默认配置
    const updatedConfig = await prisma.vectorModelConfig.update({
      where: { id },
      data: { isDefault: true }
    })
    
    // 返回解密后的配置
    return NextResponse.json({
      ...updatedConfig,
      apiKey: await decrypt(updatedConfig.apiKey)
    })
  } catch (error) {
    console.error('设置默认向量配置失败:', error)
    return NextResponse.json(
      { error: '设置默认向量配置失败' },
      { status: 500 }
    )
  }
} 