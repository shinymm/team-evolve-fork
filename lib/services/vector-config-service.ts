import { useVectorConfigStore } from '../stores/vector-config-store'
import { encrypt } from '@/lib/utils/encryption-utils';

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
 * 返回的配置中apiKey保持加密状态
 */
export async function getVectorConfig(): Promise<VectorModelConfig | undefined> {
  try {
    const response = await fetch('/api/vector-config/default')
    if (!response.ok) {
      throw new Error('获取默认配置失败')
    }
    const config = await response.json()
    if (!config) return undefined
    
    // 存储到store时保持apiKey的加密状态
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
    // 先清除store中的旧配置，再设置新的默认配置
    useVectorConfigStore.getState().clearDefaultConfig()
    useVectorConfigStore.getState().setDefaultConfig(updatedConfig)
  } catch (error) {
    console.error('设置默认配置失败:', error)
    throw error
  }
}

/**
 * 获取所有向量模型配置
 * 返回的配置中apiKey保持加密状态
 */
export const getAllVectorConfigs = async (): Promise<VectorModelConfig[]> => {
  try {
    const response = await fetch('/api/vector-config')
    if (!response.ok) {
      throw new Error('获取配置列表失败')
    }
    const configs = await response.json()
    
    // 找到默认配置并更新store
    const defaultConfig = configs.find((c: VectorModelConfig) => c.isDefault)
    if (defaultConfig) {
      useVectorConfigStore.getState().clearDefaultConfig()
      useVectorConfigStore.getState().setDefaultConfig(defaultConfig)
    } else {
      useVectorConfigStore.getState().clearDefaultConfig()
    }
    
    return configs
  } catch (error) {
    console.error('获取配置列表失败:', error)
    throw error
  }
}

/**
 * 添加新的向量模型配置
 * @param config 配置对象（apiKey为明文）
 * @returns 保存的配置（apiKey为加密状态）
 */
export const addVectorConfig = async (config: VectorModelConfig): Promise<VectorModelConfig> => {
  try {
    // 先加密API密钥
    const encryptedConfig = {
      ...config,
      apiKey: await encrypt(config.apiKey)
    };

    const response = await fetch('/api/vector-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(encryptedConfig),
    })
    
    if (!response.ok) {
      throw new Error('添加配置失败')
    }
    
    const savedConfig = await response.json()
    
    // 如果是默认配置，先清除store中的旧配置，再设置新的默认配置
    if (config.isDefault) {
      useVectorConfigStore.getState().clearDefaultConfig()
      useVectorConfigStore.getState().setDefaultConfig(savedConfig)
    }

    return savedConfig
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
    
    // 删除后重新获取所有配置，确保store状态正确
    const configs = await getAllVectorConfigs()
    const newDefaultConfig = configs.find(c => c.isDefault)
    
    // 更新store
    useVectorConfigStore.getState().clearDefaultConfig()
    if (newDefaultConfig) {
      useVectorConfigStore.getState().setDefaultConfig(newDefaultConfig)
    }
  } catch (error) {
    console.error('删除配置失败:', error)
    throw error
  }
} 