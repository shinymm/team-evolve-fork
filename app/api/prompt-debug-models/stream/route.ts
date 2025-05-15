import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRedisClient } from '@/lib/redis'
import { decrypt } from '@/lib/utils/encryption-utils'

// 流式响应函数
export async function POST(req: NextRequest) {
  // 确保是流式响应
  const encoder = new TextEncoder()
  const customReadable = new ReadableStream({
    async start(controller) {
      try {
        // 验证用户身份
        const session = await getServerSession(authOptions) as any
        if (!session || !session.user?.id) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: '未授权访问' })))
          controller.close()
          return
        }

        // 解析请求
        const { prompt, modelId } = await req.json()
        if (!prompt || !modelId) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: '参数不完整' })))
          controller.close()
          return
        }

        // 从Redis获取模型配置
        const userId = session.user.id
        const redis = await getRedisClient()
        const key = `prompt-debug:models:${userId}`
        
        const modelsData = await redis.get(key)
        if (!modelsData) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: '未找到模型配置' })))
          controller.close()
          return
        }
        
        const models = JSON.parse(modelsData)
        const modelConfig = models.find((m: any) => m.id === modelId)
        
        if (!modelConfig) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: '未找到指定模型' })))
          controller.close()
          return
        }

        // 解密API密钥
        let apiKey = modelConfig.apiKey
        if (modelConfig._encrypted) {
          try {
            apiKey = await decrypt(apiKey)
          } catch (decryptError) {
            console.error('API密钥解密失败', decryptError)
            controller.enqueue(encoder.encode(JSON.stringify({ error: 'API密钥解密失败' })))
            controller.close()
            return
          }
        }

        // 根据不同模型类型构建请求
        let apiUrl = modelConfig.baseURL
        let headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        let body: any = {}
        
        // OpenAI 风格 API (通用适配器)
        if (modelConfig.baseURL.includes('openai') || 
            modelConfig.baseURL.includes('deepseek') || 
            modelConfig.baseURL.includes('aliyuncs.com') ||
            modelConfig.baseURL.includes('bigmodel.cn')) {
          apiUrl = `${modelConfig.baseURL}/chat/completions`
          
          // API 密钥添加到请求头
          if (modelConfig.baseURL.includes('bigmodel.cn')) {
            // 智谱AI
            headers['Authorization'] = apiKey
          } else {
            // OpenAI兼容风格
            headers['Authorization'] = `Bearer ${apiKey}`
          }
          
          body = {
            model: modelConfig.model,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            temperature: modelConfig.temperature
          }
        }
        // Gemini
        else if (modelConfig.baseURL.includes('googleapis')) {
          apiUrl = `${modelConfig.baseURL}/models/${modelConfig.model}:streamGenerateContent?key=${apiKey}`
          body = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: modelConfig.temperature
            }
          }
        }
        // 其他API类型可以继续添加
        else {
          controller.enqueue(encoder.encode(JSON.stringify({ error: '不支持的模型类型' })))
          controller.close()
          return
        }
        
        // 发起请求
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          })
          
          if (!response.ok) {
            const errorData = await response.text()
            controller.enqueue(encoder.encode(JSON.stringify({ 
              error: `模型API调用失败: ${response.status} ${response.statusText}`,
              details: errorData
            })))
            controller.close()
            return
          }
          
          if (!response.body) {
            controller.enqueue(encoder.encode(JSON.stringify({ error: '无法获取响应流' })))
            controller.close()
            return
          }
          
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              
              const chunk = decoder.decode(value)
              
              // 根据不同API类型处理不同的流式响应格式
              if (modelConfig.baseURL.includes('openai') || 
                  modelConfig.baseURL.includes('deepseek') || 
                  modelConfig.baseURL.includes('aliyuncs.com') ||
                  modelConfig.baseURL.includes('bigmodel.cn')) {
                // OpenAI 兼容风格的响应处理
                const lines = chunk
                  .split('\n')
                  .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')
                
                for (const line of lines) {
                  try {
                    // 提取 JSON 部分
                    const jsonStr = line.replace(/^data: /, '').trim()
                    if (!jsonStr) continue
                    
                    const json = JSON.parse(jsonStr)
                    const content = json.choices?.[0]?.delta?.content || ''
                    
                    if (content) {
                      controller.enqueue(encoder.encode(content))
                    }
                  } catch (e) {
                    console.error('解析流式响应错误:', e)
                  }
                }
              }
              // Gemini 响应处理
              else if (modelConfig.baseURL.includes('googleapis')) {
                try {
                  const lines = chunk.split('\n').filter(line => line.trim() !== '')
                  
                  for (const line of lines) {
                    try {
                      const json = JSON.parse(line)
                      const content = json.candidates?.[0]?.content?.parts?.[0]?.text || ''
                      
                      if (content) {
                        controller.enqueue(encoder.encode(content))
                      }
                    } catch (e) {
                      console.error('解析Gemini响应错误:', e)
                    }
                  }
                } catch (e) {
                  console.error('处理Gemini流式响应错误:', e)
                }
              }
            }
          } catch (readError) {
            console.error('读取流式响应错误:', readError)
          } finally {
            reader.releaseLock()
          }
        } catch (fetchError: any) {
          console.error('调用API错误:', fetchError)
          controller.enqueue(encoder.encode(JSON.stringify({ 
            error: `调用API错误: ${fetchError.message || '未知错误'}` 
          })))
        }
      } catch (error) {
        console.error('流式响应处理错误:', error)
        controller.enqueue(encoder.encode(JSON.stringify({ error: '内部服务错误' })))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
} 