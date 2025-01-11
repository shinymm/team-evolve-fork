export interface AIModelConfig {
  model: string
  apiKey: string
  baseURL?: string
  temperature?: number
}

export const getDefaultConfig = (): AIModelConfig | null => {
  try {
    const configs = localStorage.getItem('aiModelConfigs')
    if (!configs) return null
    
    const allConfigs = JSON.parse(configs)
    const defaultConfig = allConfigs.find((c: any) => c.isDefault)
    
    if (!defaultConfig) return null
    
    return {
      model: defaultConfig.modelName,
      apiKey: defaultConfig.apiKey,
      baseURL: defaultConfig.url,
      temperature: defaultConfig.temperature
    }
  } catch (error) {
    console.error('Error getting default config:', error)
    return null
  }
}

export const streamingAICall = async (
  prompt: string,
  config: AIModelConfig,
  onContent: (content: string) => void
) => {
  try {
    console.log('Calling AI with config:', {
      baseURL: config.baseURL,
      model: config.model,
      temperature: config.temperature
    })

    const requestBody = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      temperature: config.temperature,
    }

    console.log('Request body:', requestBody)

    const response = await fetch(config.baseURL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Response status:', response.status)

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
        console.log('Raw chunk:', chunk)  // 打印原始响应块

        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')

        for (const line of lines) {
          if (line.includes('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              const content = data.choices[0]?.delta?.content || ''
              if (content) {
                console.log('Parsed content:', content)  // 打印解析后的内容
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