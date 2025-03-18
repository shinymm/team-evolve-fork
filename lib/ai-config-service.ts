import type { AIModelConfig } from './ai-service'
import { useAIConfigStore } from './stores/ai-config-store'

/**
 * 获取默认AI模型配置
 * @returns 默认AI模型配置，如果没有则返回null
 */
export function getAIConfig(): AIModelConfig | null {
  return useAIConfigStore.getState().getConfig()
}

/**
 * 设置默认AI模型配置
 * @param config 要设置为默认的配置
 */
export const setAIConfig = (config: AIModelConfig) => {
  const store = useAIConfigStore.getState()
  
  // 为配置生成ID（如果没有）
  const configToSet = {
    ...config,
    id: config.id || `default-${Date.now()}`,
    isDefault: true
  }
  
  // 如果已存在，则更新；否则添加
  if (store.configs.some(c => c.id === configToSet.id)) {
    store.updateConfig(configToSet.id, configToSet)
  } else {
    store.addConfig(configToSet)
  }
}

/**
 * 获取所有AI模型配置
 * @returns 所有配置数组
 */
export const getAllAIConfigs = (): AIModelConfig[] => {
  return useAIConfigStore.getState().configs
}

/**
 * 根据ID获取特定配置
 * @param id 配置ID
 * @returns 配置对象，如果不存在则返回null
 */
export const getConfigById = (id: string): AIModelConfig | null => {
  const configs = useAIConfigStore.getState().configs
  const config = configs.find(c => c.id === id)
  return config || null
}

/**
 * 添加新的AI模型配置
 * @param config 要添加的配置
 */
export const addAIConfig = (config: AIModelConfig) => {
  useAIConfigStore.getState().addConfig(config)
}

/**
 * 更新已有的AI模型配置
 * @param id 配置ID
 * @param config 更新后的配置对象
 */
export const updateAIConfig = (id: string, config: Partial<AIModelConfig>) => {
  useAIConfigStore.getState().updateConfig(id, config)
}

/**
 * 删除AI模型配置
 * @param id 要删除的配置ID
 */
export const deleteAIConfig = (id: string) => {
  useAIConfigStore.getState().deleteConfig(id)
}

/**
 * 设置默认AI模型配置
 * @param id 要设为默认的配置ID
 */
export const setDefaultAIConfig = (id: string) => {
  useAIConfigStore.getState().setDefaultConfig(id)
} 