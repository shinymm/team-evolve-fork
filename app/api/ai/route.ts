import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig } from '@/lib/ai-service'

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

    const modelToUse = config.model
    const urlToUse = config.baseURL

    // 移除末尾的斜杠
    const baseURL = urlToUse.replace(/\/+$/, '')
    
    // 根据不同的 AI 服务提供商使用不同的 endpoint 和请求头
    let endpoint = ''
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (baseURL.includes('open.bigmodel.cn')) {
      // 智谱 AI
      endpoint = `${baseURL}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
    } else if (baseURL.includes('openai.com')) {
      // OpenAI
      endpoint = `${baseURL}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
    } else {
      // 其他服务，使用默认 endpoint
      endpoint = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }
    
    // 创建一个新的响应流
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    
    // 发送请求到AI服务
    fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        stream: true
      })
    }).then(async (response) => {
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
    }).catch(error => {
      console.error('请求AI服务时出错:', error)
      writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error.message })}\n\n`))
      writer.close()
    })
    
    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
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