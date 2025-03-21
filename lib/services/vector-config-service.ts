import type { VectorModelConfig } from '../stores/vector-config-store'
import { useVectorConfigStore } from '../stores/vector-config-store'

/**
 * 获取默认向量模型配置
 * @returns 默认向量模型配置，如果没有则返回undefined
 */
export function getVectorConfig(): VectorModelConfig | undefined {
  return useVectorConfigStore.getState().getDefaultConfig()
}

/**
 * 设置默认向量模型配置
 * @param config 要设置为默认的配置
 */
export const setVectorConfig = (config: VectorModelConfig) => {
  const store = useVectorConfigStore.getState()
  
  // 为配置生成ID（如果没有）
  const configToSet = {
    ...config,
    id: config.id || `default-${Date.now()}`,
    isDefault: true
  }
  
  // 如果已存在，则更新；否则添加
  const existingConfig = store.getConfig(configToSet.id)
  if (existingConfig) {
    store.updateConfig(configToSet.id, configToSet)
  } else {
    store.addConfig(configToSet)
  }
}

/**
 * 获取所有向量模型配置
 * @returns 所有配置数组
 */
export const getAllVectorConfigs = (): VectorModelConfig[] => {
  return useVectorConfigStore.getState().configs
}

/**
 * 根据ID获取特定配置
 * @param id 配置ID
 * @returns 配置对象，如果不存在则返回undefined
 */
export const getVectorConfigById = (id: string): VectorModelConfig | undefined => {
  return useVectorConfigStore.getState().getConfig(id)
}

/**
 * 添加新的向量模型配置
 * @param config 要添加的配置
 */
export const addVectorConfig = (config: VectorModelConfig) => {
  useVectorConfigStore.getState().addConfig(config)
}

/**
 * 更新已有的向量模型配置
 * @param id 配置ID
 * @param config 更新后的配置对象
 */
export const updateVectorConfig = (id: string, config: VectorModelConfig) => {
  useVectorConfigStore.getState().updateConfig(id, config)
}

/**
 * 删除向量模型配置
 * @param id 要删除的配置ID
 */
export const deleteVectorConfig = (id: string) => {
  useVectorConfigStore.getState().deleteConfig(id)
}

/**
 * 设置默认向量模型配置
 * @param id 要设为默认的配置ID
 */
export const setDefaultVectorConfig = (id: string) => {
  useVectorConfigStore.getState().setDefaultConfig(id)
} 