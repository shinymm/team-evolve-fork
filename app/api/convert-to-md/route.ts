import { NextRequest, NextResponse } from 'next/server'
import { requirementToMdPrompt } from '@/lib/prompts/requirement-to-md'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { fileIds, apiConfig } = await request.json()
    
    if (!fileIds || !fileIds.length) {
      return NextResponse.json(
        { error: '请提供文件ID' },
        { status: 400 }
      )
    }
    
    if (!apiConfig) {
      return NextResponse.json(
        { error: '请提供API配置' },
        { status: 400 }
      )
    }
    
    const { model, apiKey, baseURL } = apiConfig
    
    if (!model || !apiKey || !baseURL) {
      return NextResponse.json(
        { error: 'API配置不完整' },
        { status: 400 }
      )
    }
    
    // 创建 OpenAI 客户端
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    })
    
    // 执行流式响应
    const responseStream = new TransformStream()
    const writer = responseStream.writable.getWriter()
    
    // 异步处理流
    const streamResponse = async () => {
      try {
        // 准备消息内容
        console.log(`使用模型 ${model}，文件IDs: ${fileIds.join(', ')}`)
        
        // 构建消息，引用已上传的文件
        const messages = [
          { role: 'system', content: 'You are a helpful assistant that converts requirement documents to Markdown format.' },
          ...fileIds.map((id: string) => ({ role: 'system', content: `fileid://${id}` })),
          { role: 'user', content: requirementToMdPrompt }
        ]
        
        console.log('发送API请求，引用文件ID...')
        
        // 创建流式完成
        const stream = await client.chat.completions.create({
          model: model,
          messages: messages as any,
          stream: true,
          temperature: 0.7,
          max_tokens: 4000
        })
        
        console.log('开始接收流式响应...')
        
        // 处理流
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            await writer.write(new TextEncoder().encode(content))
          }
        }
        
        console.log('流式响应接收完成')
        await writer.close()
      } catch (error) {
        console.error('Streaming error:', error)
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        await writer.write(new TextEncoder().encode(`错误: ${errorMessage}`))
        await writer.close()
      }
    }
    
    // 开始异步处理
    streamResponse()
    
    // 返回流式响应
    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      }
    })
    
  } catch (error) {
    console.error('处理请求出错:', error)
    return NextResponse.json(
      { error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
} 