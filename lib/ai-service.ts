export interface AIModelConfig {
  model: string        // 模型名称
  apiKey: string      // API密钥
  baseURL: string     // API基础URL
  temperature?: number // 温度参数
  id?: string         // 配置项ID（仅用于UI管理）
  name?: string       // 配置项显示名称（仅用于UI管理）
  isDefault?: boolean // 是否为默认配置（仅用于UI管理）
}

// export const getDefaultConfig = (): AIModelConfig | null => {
//   try {
//     const configs = localStorage.getItem('aiModelConfigs')
//     if (!configs) return null
    
//     const allConfigs = JSON.parse(configs)
//     const defaultConfig = allConfigs.find((c: any) => c.isDefault)
    
//     if (!defaultConfig) return null
    
//     return {
//       model: defaultConfig.model,
//       apiKey: defaultConfig.apiKey,
//       baseURL: defaultConfig.baseURL,
//       temperature: defaultConfig.temperature
//     }
//   } catch (error) {
//     console.error('Error getting default config:', error)
//     return null
//   }
// }

export async function streamingAICall(
  prompt: string,
  config: AIModelConfig,
  onContent: (content: string) => void
) {
  try {
    // 使用 modelName 或 model
    const modelToUse = config.model || config.model
    // 使用 url 或 baseURL
    const urlToUse = config.baseURL || config.baseURL

    console.log('Calling AI with config:', {
      baseURL: urlToUse,
      model: modelToUse,
      temperature: config.temperature
    })

    const baseURL = urlToUse.replace(/\/+$/, '')
    
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.7,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('API error response:', error)
      throw new Error(error)
    }

    if (response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        // console.log('Raw chunk:', chunk)  // 打印原始响应块

        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')

        for (const line of lines) {
          if (line.includes('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              const content = data.choices[0]?.delta?.content || ''
              if (content) {
                // console.log('Parsed content:', content)  // 打印解析后的内容
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
    throw error
  }
} 