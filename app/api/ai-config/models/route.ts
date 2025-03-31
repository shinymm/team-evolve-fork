import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // 从数据库获取
    const dbModels = await prisma.aIModelConfig.findMany({
      select: {
        id: true,
        name: true,
        model: true,
        baseURL: true,
        apiKey: true,
        temperature: true,
        isDefault: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ models: dbModels })
  } catch (error) {
    console.error('获取模型列表失败:', error)
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    )
  }
} 