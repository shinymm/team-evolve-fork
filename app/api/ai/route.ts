import { NextRequest, NextResponse } from 'next/server'
import { AIModelConfig, isGeminiModel, getApiEndpointAndHeaders } from '@/lib/services/ai-service'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { decrypt } from '@/lib/utils/encryption-utils'
import { aiModelConfigService } from '@/lib/services/ai-model-config-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json() as { prompt: string }

    if (!prompt) {
      return NextResponse.json(
        { error: '缺少提示词' },
        { status: 400 }
      )
    }

    // 获取默认配置
    const config = await aiModelConfigService.getDefaultConfig()
    if (!config) {
      return NextResponse.json(
        { error: '未找到默认配置' },
        { status: 404 }
      )
    }

    // 解密 API Key
    const decryptedApiKey = await decrypt(config.apiKey)

    const configWithDecryptedKey = {
      ...config,
      apiKey: decryptedApiKey
    }

    console.log('使用默认配置:', {
      model: config.model,
      baseURL: config.baseURL,
      hasApiKey: !!decryptedApiKey,
      apiKeyLength: decryptedApiKey?.length || 0
    })

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
        if (isGeminiModel(configWithDecryptedKey.model)) {
          // 使用Google的库初始化客户端
          const genAI = new GoogleGenerativeAI(configWithDecryptedKey.apiKey)
          const model = genAI.getGenerativeModel({ model: configWithDecryptedKey.model })
          
          // 创建请求
          const request = {
            contents: [{
              role: 'user',
              parts: [{ text: prompt }]
            }],
            generationConfig: configWithDecryptedKey.temperature !== undefined ? {
              temperature: configWithDecryptedKey.temperature
            } : undefined
          }
          
          // 发送流式请求
          const result = await model.generateContentStream(request)
          
          console.log('Gemini响应开始流式传输')
          
          // 处理 Gemini 的流式响应
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              // 使用 OpenAI 格式包装内容
              const response = {
                choices: [
                  {
                    delta: {
                      content: text
                    }
                  }
                ]
              }
              await writer.write(encoder.encode(`data: ${JSON.stringify(response)}\n\n`))
            }
          }
        } else {
          // 处理标准 OpenAI 兼容的 API
          const { endpoint, headers: requestHeaders } = getApiEndpointAndHeaders(configWithDecryptedKey)
          
          // console.log('调用标准OpenAI API:', {
          //   endpoint,
          //   model: configWithDecryptedKey.model,
          //   baseURL: configWithDecryptedKey.baseURL,
          //   hasApiKey: !!configWithDecryptedKey.apiKey,
          //   temperature: configWithDecryptedKey.temperature
          // })

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({
              model: configWithDecryptedKey.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: configWithDecryptedKey.temperature || 0.7,
              stream: true
            })
          })

          if (!response.ok) {
            const error = await response.text()
            console.error('API请求失败:', {
              status: response.status,
              statusText: response.statusText,
              error,
              endpoint,
              model: configWithDecryptedKey.model
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

              const data = line.slice(6).trim()
              
              if (data === '[DONE]') {
                await writer.write(encoder.encode('data: [DONE]\n\n'))
                continue
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content || ''
                if (content) {
                  const response = {
                    choices: [
                      {
                        delta: {
                          content: content
                        }
                      }
                    ]
                  }
                  const responseStr = `data: ${JSON.stringify(response)}\n\n`
                  await writer.write(encoder.encode(responseStr))
                }
              } catch (e) {
                console.error('解析响应数据失败:', { error: e, data })
                if (data && typeof data === 'string') {
                  const response = {
                    choices: [
                      {
                        delta: {
                          content: data
                        }
                      }
                    ]
                  }
                  await writer.write(encoder.encode(`data: ${JSON.stringify(response)}\n\n`))
                }
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
    baseURL: config.baseURL
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
    console.log('准备发送请求到AI服务，配置信息:', {
      model: config.model,
      baseURL: config.baseURL,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.substring(0, 10)}...`
      }
    })
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
                // 使用 OpenAI 格式包装内容
                const response = {
                  choices: [
                    {
                      delta: {
                        content: content
                      }
                    }
                  ]
                }
                await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(response)}\n\n`))
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