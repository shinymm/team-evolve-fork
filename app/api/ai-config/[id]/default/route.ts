import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    
    // 检查配置是否存在
    const existingConfig = await prisma.aIModelConfig.findUnique({
      where: { id }
    })
    
    if (!existingConfig) {
      return NextResponse.json({ error: '未找到配置' }, { status: 404 })
    }
    
    // 先将所有配置的isDefault设为false
    await prisma.aIModelConfig.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
    
    // 将当前配置设为默认
    const result = await prisma.aIModelConfig.update({
      where: { id },
      data: { isDefault: true },
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('设置默认配置失败:', error)
    return NextResponse.json({ error: '设置默认配置失败' }, { status: 500 })
  }
} 