import type { AIModelConfig } from './ai-service'

const AI_CONFIG_KEY = 'aiModelConfigs'

export function getAIConfig(): AIModelConfig | null {
  try {
    const configStr = localStorage.getItem(AI_CONFIG_KEY)
    console.log('Reading AI config from:', AI_CONFIG_KEY)
    if (!configStr) return null

    const allConfigs = JSON.parse(configStr)
    const defaultConfig = allConfigs.find((c: any) => c.isDefault)
    console.log('Found default config:', defaultConfig)

    if (!defaultConfig) return null

    return {
      model: defaultConfig.model,
      apiKey: defaultConfig.apiKey,
      baseURL: defaultConfig.baseURL,
      temperature: defaultConfig.temperature
    }
  } catch (error) {
    console.error('Error loading AI config:', error)
    return null
  }
}

export const setAIConfig = (config: AIModelConfig) => {
  if (typeof window === 'undefined') return
  
  try {
    const configStr = localStorage.getItem(AI_CONFIG_KEY)
    const allConfigs = configStr ? JSON.parse(configStr) : []
    
    const defaultConfig = {
      id: 'default',
      name: 'Default Configuration',
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      temperature: config.temperature,
      isDefault: true
    }

    const updatedConfigs = allConfigs.map((c: any) => ({
      ...c,
      isDefault: false
    }))

    const existingDefaultIndex = updatedConfigs.findIndex((c: any) => c.id === 'default')
    if (existingDefaultIndex >= 0) {
      updatedConfigs[existingDefaultIndex] = defaultConfig
    } else {
      updatedConfigs.push(defaultConfig)
    }

    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(updatedConfigs))
    console.log('Saved AI config:', updatedConfigs)
  } catch (error) {
    console.error('Error setting AI config:', error)
  }
} 