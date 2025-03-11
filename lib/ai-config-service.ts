import type { AIModelConfig } from './ai-service'
import { useAIConfigStore } from './stores/ai-config-store'

// 这些函数现在只是对Zustand store的包装，保持API兼容性
export function getAIConfig(): AIModelConfig | null {
  return useAIConfigStore.getState().getConfig()
}

export const setAIConfig = (config: AIModelConfig) => {
  const store = useAIConfigStore.getState()
  const existingDefault = store.configs.find(c => c.id === 'default')
  
  if (existingDefault) {
    store.updateConfig('default', {
      ...config,
      isDefault: true
    })
  } else {
    store.addConfig({
      ...config,
      id: 'default',
      name: 'Default Configuration',
      isDefault: true
    })
  }
}

// 添加新的辅助函数，方便获取所有配置
export const getAllAIConfigs = (): AIModelConfig[] => {
  return useAIConfigStore.getState().configs
} 