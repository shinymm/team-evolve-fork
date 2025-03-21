import { NextResponse } from 'next/server'
import { VectorModelConfig } from '@/lib/services/embedding-service'
import { getEmbedding } from '@/lib/services/embedding-service'

export async function POST(request: Request) {
  try {
    // 解析请求体
    const { baseURL, apiKey, model, name } = await request.json() as VectorModelConfig

    // 检查必要的参数
    if (!baseURL || !apiKey || !model) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少必要的参数: baseURL, apiKey, model' 
      }, { status: 400 })
    }

    // 构建配置对象
    const config: VectorModelConfig = {
      baseURL,
      apiKey,
      model,
      name: name || `${model} (测试)`,
    }

    // 生成测试文本的嵌入向量
    const testText = '这是一个测试'
    const embedding = await getEmbedding(testText, config)

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        embedding: embedding.slice(0, 5), // 只返回前5个向量值作为示例
        dimensions: embedding.length,
        testText
      }
    })
  } catch (error) {
    console.error('测试嵌入失败:', error)
    
    // 返回错误响应
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '测试嵌入失败'
    }, { status: 500 })
  }
} 