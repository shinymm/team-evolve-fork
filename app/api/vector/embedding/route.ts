import { NextResponse } from 'next/server'
import { getEmbedding } from '@/lib/embedding-service'
import type { VectorModelConfig } from '@/lib/embedding-service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, config } = body as { text: string, config: VectorModelConfig }
    
    if (!text) {
      return NextResponse.json(
        { error: '缺少必要的文本参数' },
        { status: 400 }
      )
    }
    
    if (!config) {
      return NextResponse.json(
        { error: '缺少向量模型配置' },
        { status: 400 }
      )
    }
    
    const embedding = await getEmbedding(text, config)
    return NextResponse.json({ embedding })
  } catch (error) {
    console.error('生成向量嵌入失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成向量嵌入失败' },
      { status: 500 }
    )
  }
} 