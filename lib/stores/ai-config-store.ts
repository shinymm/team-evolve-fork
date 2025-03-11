import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModelConfig } from '../ai-service'

interface AIConfigState {
  configs: AIModelConfig[]
  defaultConfig: AIModelConfig | null
  
  // 操作方法
  addConfig: (config: Partial<AIModelConfig>) => void
  deleteConfig: (id: string) => void
  setDefaultConfig: (id: string) => void
  updateConfig: (id: string, config: Partial<AIModelConfig>) => void
  getConfig: () => AIModelConfig | null
}

// 简化 store 的实现，完全依赖 Zustand 的 persist 中间件
export const useAIConfigStore = create<AIConfigState>()(
  persist(
    (set, get) => ({
      configs: [],
      defaultConfig: null,

      addConfig: (config: Partial<AIModelConfig>) => {
        if (!config.baseURL || !config.model || !config.apiKey) {
          console.error('无法添加配置：缺少必要字段')
          return
        }

        const configToAdd: AIModelConfig = {
          model: config.model,
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          temperature: config.temperature || 0.2,
          id: config.id || Date.now().toString(),
          name: config.name || `${config.model} (${new Date().toLocaleString()})`,
          isDefault: config.isDefault || get().configs.length === 0,
        }

        set((state) => {
          // 如果新配置是默认配置，则更新其他配置为非默认
          let updatedConfigs = state.configs.map(c => ({
            ...c,
            isDefault: configToAdd.isDefault ? false : c.isDefault
          }))
          
          return {
            configs: [...updatedConfigs, configToAdd],
            defaultConfig: configToAdd.isDefault ? configToAdd : state.defaultConfig
          }
        })
      },

      deleteConfig: (id: string) => {
        set((state) => {
          const configToDelete = state.configs.find(c => c.id === id)
          const updatedConfigs = state.configs.filter(c => c.id !== id)
          
          // 如果删除的是默认配置且还有其他配置，则将第一个配置设为默认
          let newDefaultConfig = state.defaultConfig
          if (configToDelete?.isDefault && updatedConfigs.length > 0) {
            updatedConfigs[0] = {
              ...updatedConfigs[0],
              isDefault: true
            }
            newDefaultConfig = updatedConfigs[0]
          } else if (updatedConfigs.length === 0) {
            newDefaultConfig = null
          }
          
          return {
            configs: updatedConfigs,
            defaultConfig: newDefaultConfig
          }
        })
      },

      setDefaultConfig: (id: string) => {
        set((state) => {
          const updatedConfigs = state.configs.map(config => ({
            ...config,
            isDefault: config.id === id
          }))
          
          const newDefaultConfig = updatedConfigs.find(config => config.id === id) || null
          
          return {
            configs: updatedConfigs,
            defaultConfig: newDefaultConfig
          }
        })
      },

      updateConfig: (id: string, updatedConfig: Partial<AIModelConfig>) => {
        set((state) => {
          const updatedConfigs = state.configs.map(config => 
            config.id === id ? { ...config, ...updatedConfig } : config
          )
          
          // 如果更新的是默认配置，则更新defaultConfig
          const newDefaultConfig = state.defaultConfig?.id === id 
            ? { ...state.defaultConfig, ...updatedConfig }
            : state.defaultConfig
          
          return {
            configs: updatedConfigs,
            defaultConfig: newDefaultConfig
          }
        })
      },

      getConfig: () => {
        return get().defaultConfig
      }
    }),
    {
      name: 'ai-model-configs'
    }
  )
)

// 兼容旧版本的API
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