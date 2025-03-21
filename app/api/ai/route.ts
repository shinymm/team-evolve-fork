import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig, isGeminiModel } from '@/lib/services/ai-service'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getApiEndpointAndHeaders } from '@/lib/services/ai-service'

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
    
    if (!config.apiKey) {
      return NextResponse.json(
        { error: '未提供有效的API配置：缺少 API Key' },
        { status: 400 }
      )
    }

    if (!config.model) {
      return NextResponse.json(
        { error: '未提供有效的API配置：缺少模型名称' },
        { status: 400 }
      )
    }

    // 设置响应头
    const responseHeaders = new Headers()
    responseHeaders.append('Content-Type', 'text/event-stream')
    responseHeaders.append('Cache-Control', 'no-cache')
    responseHeaders.append('Connection', 'keep-alive')

    // 创建新的 TransformStream 来处理数据
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // 在后台处理流
    const processStream = async () => {
      try {
        // 检查是否是 Gemini 模型
        if (isGeminiModel(config.model)) {
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
            }],
            generationConfig: config.temperature !== undefined ? {
              temperature: config.temperature
            } : undefined
          }
          
          // 发送流式请求
          const result = await model.generateContentStream(request)
          
          console.log('Gemini响应开始流式传输')
          
          // 处理 Gemini 的流式响应
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`))
            }
          }
        } else {
          // 对于非 Gemini 模型，检查 baseUrl
          if (!config.baseUrl) {
            throw new Error('未提供有效的API配置：缺少 API 地址')
          }

          // 处理标准 OpenAI 兼容的 API
          const { endpoint, headers: requestHeaders } = getApiEndpointAndHeaders(config)
          
          console.log('调用AI服务 @ ai.route.ts:', {
            endpoint,
            model: config.model
          })

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: config.temperature || 0.7,
              stream: true
            })
          })

          // 如果响应不成功，抛出错误
          if (!response.ok) {
            const error = await response.text()
            console.error('API请求失败:', {
              status: response.status,
              statusText: response.statusText,
              error,
              endpoint,
              model: config.model
            })
            throw new Error(`API 请求失败 (${response.status}): ${error}`)
          }

          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('无法获取响应流')
          }

          const decoder = new TextDecoder()
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.trim() === '') continue
              if (!line.startsWith('data: ')) continue

              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                if (content) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {
                console.error('解析响应数据失败:', e)
              }
            }
          }
        }
      } catch (error: unknown) {
        console.error('处理流数据时出错:', error)
        const errorMessage = error instanceof Error ? error.message : '未知错误'
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`))
      } finally {
        await writer.close()
      }
    }

    // 启动流处理
    processStream()

    // 返回可读流
    return new Response(readable, {
      headers: responseHeaders
    })
  } catch (error: unknown) {
    console.error('AI服务错误:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// 处理Google Gemini模型的流式请求
async function handleGeminiStream(prompt: string, config: AIModelConfig) {
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
    
    // 设置响应头
    const responseHeaders = new Headers()
    responseHeaders.append('Content-Type', 'text/event-stream')
    responseHeaders.append('Cache-Control', 'no-cache')
    responseHeaders.append('Connection', 'keep-alive')

    // 创建新的 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(`data: ${JSON.stringify({ content: text })}\n\n`)
            }
          }
        } catch (error: unknown) {
          console.error('处理Gemini流数据时出错:', error)
          const errorMessage = error instanceof Error ? error.message : '未知错误'
          controller.enqueue(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: responseHeaders
    })
  } catch (error: unknown) {
    console.error('请求Gemini服务时出错:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: errorMessage },
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
    baseUrl: config.baseUrl
  })
  
  if (isGemini) {
    // 处理Google Gemini模型的请求
    handleGeminiStream(prompt, config)
  } else {
    // 处理标准OpenAI兼容API的请求
    handleStandardStream(prompt, config, writer)
  }
}

// 处理标准OpenAI兼容API的请求
async function handleStandardStream(prompt: string, config: AIModelConfig, writer: WritableStreamDefaultWriter) {
  try {
    // 移除末尾的斜杠
    const baseUrl = config.baseUrl.replace(/\/+$/, '')
    
    // 根据不同的 AI 服务提供商使用不同的 endpoint 和请求头
    let endpoint = ''
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`
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
  }
}