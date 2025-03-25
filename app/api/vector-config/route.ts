import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/utils/encryption-utils'

const prisma = new PrismaClient()

// 获取所有配置
export async function GET() {
  try {
    const configs = await prisma.vectorModelConfig.findMany()
    
    // 解密API密钥
    const decryptedConfigs = await Promise.all(
      configs.map(async (config) => ({
        ...config,
        apiKey: await decrypt(config.apiKey)
      }))
    )
    
    return NextResponse.json(decryptedConfigs)
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
    
    // 加密API密钥
    const encryptedApiKey = await encrypt(config.apiKey)
    
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
        apiKey: encryptedApiKey,
        dimension: config.dimension,
        isDefault: config.isDefault || false,
        provider: config.provider || null,
      }
    })
    
    // 返回解密后的配置
    return NextResponse.json({
      ...savedConfig,
      apiKey: config.apiKey // 返回原始未加密的apiKey
    })
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
    
    // 删除配置
    await prisma.vectorModelConfig.delete({
      where: { id }
    })
    
    // 如果删除的是默认配置，设置最新的配置为默认
    if (configToDelete?.isDefault) {
      const newDefault = await prisma.vectorModelConfig.findFirst({
        orderBy: { createdAt: 'desc' }
      })
      
      if (newDefault) {
        await prisma.vectorModelConfig.update({
          where: { id: newDefault.id },
          data: { isDefault: true }
        })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除向量配置失败:', error)
    return NextResponse.json(
      { error: '删除向量配置失败' },
      { status: 500 }
    )
  }
} 