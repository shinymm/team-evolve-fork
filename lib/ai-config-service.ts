import type { AIModelConfig } from './ai-service'

const AI_CONFIG_KEY = 'ai_config'

export const getAIConfig = (): AIModelConfig | null => {
  // 优先从内存中获取
  if (typeof window === 'undefined') return null
  
  try {
    const cached = localStorage.getItem(AI_CONFIG_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
    
    // 如果没有缓存，获取默认配置
    const defaultConfig: AIModelConfig = {
      model: 'gpt-3.5-turbo',
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
      baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
    }
    
    // 缓存默认配置
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(defaultConfig))
    return defaultConfig
  } catch (error) {
    console.error('Error getting AI config:', error)
    return null
  }
}

export const setAIConfig = (config: AIModelConfig) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config))
  } catch (error) {
    console.error('Error setting AI config:', error)
  }
} 