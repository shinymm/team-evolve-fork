import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const defaultConfig = await prisma.aIModelConfig.findFirst({
      where: { isDefault: true }
    })

    if (!defaultConfig) {
      return NextResponse.json(null)
    }

    // 转换字段名
    const transformedConfig = {
      ...defaultConfig,
      baseUrl: defaultConfig.baseURL,
      baseURL: undefined
    }

    return NextResponse.json(transformedConfig)
  } catch (error) {
    console.error('获取默认AI配置失败:', error)
    return NextResponse.json({ error: '获取默认AI配置失败' }, { status: 500 })
  }
} 