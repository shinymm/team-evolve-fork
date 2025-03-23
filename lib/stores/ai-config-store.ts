import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AIModelConfig } from '../services/ai-service'

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
          isDefault: !!config.isDefault,
        }
        
        console.log(`添加配置 ${configToAdd.id} (${configToAdd.name}): isDefault = ${configToAdd.isDefault}`)

        set((state) => {
          let updatedConfigs: AIModelConfig[] = [...state.configs]
          
          // 如果新配置是默认配置，则确保所有其他配置都设为非默认
          if (configToAdd.isDefault) {
            updatedConfigs = updatedConfigs.map(c => ({
              ...c,
              isDefault: false
            }))
          }
          
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
        console.log("设置默认配置ID:", id);
        set((state) => {
          // 确保所有配置都设为非默认，除了指定的那个
          const updatedConfigs = state.configs.map(config => {
            const isDefault = config.id === id;
            console.log(`配置 ${config.id} (${config.name}): isDefault = ${isDefault}`);
            return {
              ...config,
              isDefault
            };
          });
          
          const newDefaultConfig = updatedConfigs.find(config => config.id === id) || null;
          
          if (newDefaultConfig) {
            console.log("新的默认配置:", newDefaultConfig.name);
          } else {
            console.log("未找到匹配的默认配置");
          }
          
          return {
            configs: updatedConfigs,
            defaultConfig: newDefaultConfig
          };
        });
      },

      updateConfig: (id: string, updatedConfig: Partial<AIModelConfig>) => {
        set((state) => {
          // 检查是否设置为默认配置
          const isBeingSetToDefault = updatedConfig.isDefault === true
          
          // 如果正在设置为默认，则确保其他配置都不是默认
          let updatedConfigs = state.configs.map(config => {
            if (config.id === id) {
              return { ...config, ...updatedConfig }
            }
            // 如果当前配置被设为默认，则其他配置都设为非默认
            return isBeingSetToDefault 
              ? { ...config, isDefault: false } 
              : config
          })
          
          // 更新defaultConfig
          const newDefaultConfig = isBeingSetToDefault
            ? updatedConfigs.find(c => c.id === id) || state.defaultConfig
            : (state.defaultConfig?.id === id 
                ? { ...state.defaultConfig, ...updatedConfig }
                : state.defaultConfig)
          
          return {
            configs: updatedConfigs,
            defaultConfig: newDefaultConfig
          }
        })
      },

      getConfig: () => {
        // 先尝试从defaultConfig获取
        const defaultConfig = get().defaultConfig;
        if (defaultConfig) {
          return defaultConfig;
        }
        
        // 如果defaultConfig为null，尝试从configs中找到isDefault为true的配置
        const configs = get().configs;
        const configWithIsDefault = configs.find(config => config.isDefault);
        if (configWithIsDefault) {
          return configWithIsDefault;
        }
        
        // 如果没有找到默认配置，返回null
        return null;
      }
    }),
    {
      name: 'ai-model-configs',
      // 强制每次都将完整状态写入localStorage，解决部分更新问题
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        configs: state.configs,
        defaultConfig: state.configs.find(c => c.isDefault) || null
      }),
      // 每次从localStorage读取后，确保defaultConfig与configs中的isDefault一致
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 找到标记为默认的配置
          const defaultConfig = state.configs.find(c => c.isDefault);
          if (defaultConfig) {
            state.defaultConfig = defaultConfig;
          }
          console.log('存储已恢复，默认配置:', state.defaultConfig?.name);
        }
      },
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