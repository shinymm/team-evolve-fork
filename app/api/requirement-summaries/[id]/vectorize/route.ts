import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEmbedding } from '@/lib/services/embedding-service'
import { z } from 'zod'

// 验证向量配置模式
const VectorConfigSchema = z.object({
  baseURL: z.string().min(1, "API地址不能为空"),
  model: z.string().min(1, "模型名称不能为空"),
  apiKey: z.string().min(1, "API Key不能为空"),
  id: z.string().optional(),
  name: z.string().optional(),
  isDefault: z.boolean().optional()
})

// 验证请求体模式
const RequestSchema = z.object({
  vectorConfig: VectorConfigSchema
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (isNaN(id)) {
      return NextResponse.json(
        { error: '无效的ID' },
        { status: 400 }
      )
    }

    // 验证请求体
    const body = await request.json()
    const { vectorConfig } = RequestSchema.parse(body)

    // 获取需求摘要
    const summary = await prisma.requirementSummary.findUnique({
      where: { id }
    })

    if (!summary) {
      return NextResponse.json(
        { error: '未找到需求摘要' },
        { status: 404 }
      )
    }

    // 生成向量嵌入
    console.log('开始生成向量嵌入，使用配置:', {
      ...vectorConfig,
      apiKey: '***' // 隐藏 API Key
    })

    const text = `${summary.name}\n${summary.summary}`
    const embedding = await getEmbedding(text, vectorConfig)

    if (!embedding) {
      console.error('生成向量嵌入失败')
      return NextResponse.json(
        { error: '生成向量嵌入失败' },
        { status: 500 }
      )
    }

    console.log('向量嵌入生成成功，长度:', embedding.length)

    // 更新需求摘要
    const updatedSummary = await prisma.requirementSummary.update({
      where: { id },
      data: {
        embedding,
        updatedAt: new Date()
      }
    })

    return NextResponse.json(updatedSummary)
  } catch (error) {
    console.error('向量化处理失败:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '向量化处理失败' },
      { status: 500 }
    )
  }
} 