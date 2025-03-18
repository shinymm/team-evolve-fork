import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { setServerSideConfig } from '@/lib/embedding-service'

export async function GET() {
  try {
    // 从数据库获取默认配置
    const defaultConfig = await prisma.vectorModelConfig.findFirst({
      where: {
        isDefault: true
      }
    })

    if (!defaultConfig) {
      return NextResponse.json({ error: '未找到默认向量模型配置' }, { status: 404 })
    }

    // 设置服务器端配置
    setServerSideConfig(defaultConfig)

    return NextResponse.json(defaultConfig)
  } catch (error) {
    console.error('获取默认向量模型配置失败:', error)
    return NextResponse.json(
      { error: '获取默认向量模型配置失败' },
      { status: 500 }
    )
  }
} 