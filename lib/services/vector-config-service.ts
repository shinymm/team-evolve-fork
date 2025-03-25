import { useVectorConfigStore } from '../stores/vector-config-store'

export type VectorModelConfig = {
  id?: string;
  name: string;
  model: string;
  baseURL: string;
  apiKey: string;
  dimension: number;
  isDefault?: boolean;
  provider?: string;
}

/**
 * 获取默认向量模型配置
 */
export async function getVectorConfig(): Promise<VectorModelConfig | undefined> {
  try {
    const response = await fetch('/api/vector-config/default')
    if (!response.ok) {
      throw new Error('获取默认配置失败')
    }
    const config = await response.json()
    if (!config) return undefined
    
    useVectorConfigStore.getState().setDefaultConfig(config)
    return config
  } catch (error) {
    console.error('获取默认配置失败:', error)
    throw error
  }
}

/**
 * 设置默认向量模型配置
 */
export const setVectorConfig = async (config: VectorModelConfig) => {
  try {
    const response = await fetch(`/api/vector-config/default?id=${config.id}`, {
      method: 'PUT'
    })
    
    if (!response.ok) {
      throw new Error('设置默认配置失败')
    }
    
    const updatedConfig = await response.json()
    useVectorConfigStore.getState().setDefaultConfig(updatedConfig)
  } catch (error) {
    console.error('设置默认配置失败:', error)
    throw error
  }
}

/**
 * 获取所有向量模型配置
 */
export const getAllVectorConfigs = async (): Promise<VectorModelConfig[]> => {
  try {
    const response = await fetch('/api/vector-config')
    if (!response.ok) {
      throw new Error('获取配置列表失败')
    }
    return response.json()
  } catch (error) {
    console.error('获取配置列表失败:', error)
    throw error
  }
}

/**
 * 添加新的向量模型配置
 */
export const addVectorConfig = async (config: VectorModelConfig) => {
  try {
    const response = await fetch('/api/vector-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    
    if (!response.ok) {
      throw new Error('添加配置失败')
    }
    
    const savedConfig = await response.json()
    
    // 如果是默认配置，更新store
    if (config.isDefault) {
      useVectorConfigStore.getState().setDefaultConfig(savedConfig)
    }
  } catch (error) {
    console.error('添加配置失败:', error)
    throw error
  }
}

/**
 * 删除向量模型配置
 */
export const deleteVectorConfig = async (id: string) => {
  try {
    const response = await fetch(`/api/vector-config?id=${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error('删除配置失败')
    }
    
    // 如果删除的是默认配置，清除store中的默认配置
    const config = useVectorConfigStore.getState().getDefaultConfig()
    if (config?.id === id) {
      useVectorConfigStore.getState().clearDefaultConfig()
    }
  } catch (error) {
    console.error('删除配置失败:', error)
    throw error
  }
} 