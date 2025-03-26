import { NextResponse } from 'next/server'
import fetch from 'node-fetch'
import { z } from 'zod'

// 搜索参数验证
const SearchSchema = z.object({
  query: z.string().min(1),
  vectorConfig: z.object({
    name: z.string(),
    model: z.string(),
    baseURL: z.string(),
    apiKey: z.string(),
  }),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { query, vectorConfig } = SearchSchema.parse(body)

    // 调用向量服务生成查询向量
    console.log('调用向量服务生成查询向量')
    const embeddingResponse = await fetch(`${vectorConfig.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vectorConfig.apiKey}`
      },
      body: JSON.stringify({
        model: vectorConfig.model,
        input: query
      })
    })

    if (!embeddingResponse.ok) {
      console.error('向量服务请求失败:', embeddingResponse.status, embeddingResponse.statusText)
      const errorData = await embeddingResponse.json()
      throw new Error(errorData.error?.message || '生成向量失败')
    }

    const embeddingData = await embeddingResponse.json()
    if (!embeddingData.data?.[0]?.embedding) {
      throw new Error('向量服务返回的数据格式无效')
    }

    const embedding = embeddingData.data[0].embedding
    console.log('成功获取查询向量，维度:', embedding.length)

    return NextResponse.json({ embedding })
  } catch (error) {
    console.error('生成向量失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成向量失败' },
      { status: 500 }
    )
  }
} 