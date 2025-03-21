import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig, isGeminiModel } from '@/lib/ai-service'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { prompt, config } = await request.json() as {
      prompt: string
      config: AIModelConfig
    }

    if (!prompt || !config) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }
    
    // 创建一个新的响应流
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // 统一处理所有模型的请求
    handleStream(prompt, config, writer)
    
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Keep-Alive': 'timeout=300, max=1000',  // 5分钟超时，最多1000个请求
        'Transfer-Encoding': 'chunked'
      }
    })
  } catch (error) {
    console.error('API路由处理错误:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// 统一处理所有模型的请求
async function handleStream(prompt: string, config: AIModelConfig, writer: WritableStreamDefaultWriter) {
  // 检查是否是Google Gemini模型
  const isGemini = isGeminiModel(config.model)
  
  console.log('handleStream检测模型类型:', {
    model: config.model,
    isGemini,
    baseURL: config.baseURL
  })
  
  if (isGemini) {
    // 处理Google Gemini模型的请求
    handleGeminiStream(prompt, config, writer)
  } else {
    // 处理标准OpenAI兼容API的请求
    handleStandardStream(prompt, config, writer)
  }
}

// 处理标准OpenAI兼容API的请求
async function handleStandardStream(prompt: string, config: AIModelConfig, writer: WritableStreamDefaultWriter) {
  try {
    // 移除末尾的斜杠
    const baseURL = config.baseURL.replace(/\/+$/, '')
    
    // 根据不同的 AI 服务提供商使用不同的 endpoint 和请求头
    let endpoint = ''
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`
    headers['Authorization'] = `Bearer ${config.apiKey}`
    console.log('使用API端点:', endpoint)
    
    // 发送请求到AI服务
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5分钟超时
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        stream: true
      })
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text()
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: `API 请求失败 (${response.status}): ${errorText}` })}\n\n`))
      writer.close()
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: '无法读取响应流' })}\n\n`))
      writer.close()
      return
    }

    const decoder = new TextDecoder()
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim() !== '')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            } catch (e) {
              console.error('解析响应数据失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('处理流数据时出错:', error)
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: '处理响应流时出错' })}\n\n`))
    } finally {
      writer.close()
    }
  } catch (error) {
    console.error('请求AI服务时出错:', error)
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' })}\n\n`))
    writer.close()
  }
}

// 处理Google Gemini模型的流式请求
async function handleGeminiStream(prompt: string, config: AIModelConfig, writer: WritableStreamDefaultWriter) {
  try {
    console.log('Gemini API请求配置:', {
      model: config.model,
      apiKey: config.apiKey ? '已设置' : '未设置',
      temperature: config.temperature
    })
    
    // 使用Google的库初始化客户端
    const genAI = new GoogleGenerativeAI(config.apiKey)
    const model = genAI.getGenerativeModel({ model: config.model })
    
    // 创建请求
    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    }
    
    // 如果设置了temperature，添加生成配置
    if (config.temperature !== undefined) {
      model.generationConfig = { temperature: config.temperature }
    }
    
    // 发送流式请求
    const result = await model.generateContentStream(request)
    
    console.log('Gemini响应开始流式传输')
    
    // 处理流式响应
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content: text })}\n\n`))
      }
    }
    
    console.log('Gemini响应流式传输完成')
    writer.close()
  } catch (error) {
    console.error('请求Gemini服务时出错:', error)
    writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : '未知错误' })}\n\n`))
    writer.close()
  }
} 