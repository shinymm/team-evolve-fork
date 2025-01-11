import { NextResponse } from 'next/server'
import type { AIModelConfig } from '@/lib/ai-service'

export async function POST(request: Request) {
  try {
    const { prompt, config } = await request.json()

    // 这里应该是实际调用 AI 模型的代码
    // 暂时返回测试数据
    return new NextResponse('分析结果示例', {
      headers: {
        'Content-Type': 'text/plain',
      },
    })

  } catch (error) {
    console.error('Test model error:', error)
    return new NextResponse(
      error instanceof Error ? error.message : '未知错误',
      { status: 500 }
    )
  }
}

