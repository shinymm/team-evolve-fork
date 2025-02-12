import { ModelConfig } from '@/components/ai-model-settings'

export interface AIModelConfig {
  model: string        // 模型名称
  apiKey: string      // API密钥
  baseURL: string     // API基础URL
  temperature?: number // 温度参数
  id?: string         // 配置项ID（仅用于UI管理）
  name?: string       // 配置项显示名称（仅用于UI管理）
  isDefault?: boolean // 是否为默认配置（仅用于UI管理）
}

export async function streamingAICall(
  prompt: string,
  config: AIModelConfig,
  onContent: (content: string) => void
) {
  try {
    const modelToUse = config.model
    const urlToUse = config.baseURL

    console.log('Calling AI with config:', {
      baseURL: urlToUse,
      model: modelToUse,
      temperature: config.temperature
    })

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
    
    console.log('Using endpoint:', endpoint)  // 调试日志
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        stream: true
      }),
      // 添加额外的 fetch 选项
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('API error response:', error)
      throw new Error(`API 请求失败 (${response.status}): ${error}`)
    }

    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        // console.log('Raw chunk:', chunk)  // 调试日志

        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')

        for (const line of lines) {
          if (line.includes('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              const content = data.choices[0]?.delta?.content || ''
              if (content) {
                // console.log('Parsed content:', content)  // 调试日志
                onContent(content)
              }
            } catch (e) {
              console.error('Error parsing SSE message:', e, line)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('AI service error:', error)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('网络请求失败，请检查：\n1. API地址是否正确\n2. 网络连接是否正常\n3. 是否存在跨域限制')
    }
    throw error
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export const callChatCompletion = async (
  messages: Message[],
  config: ModelConfig
): Promise<string | null> => {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        ...config,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to call AI API')
    }

    const data = await response.json()
    return data.content
  } catch (error) {
    console.error('Error calling AI API:', error)
    return null
  }
} 