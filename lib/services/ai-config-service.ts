import type { AIModelConfig } from './ai-service'
import { useAIConfigStore } from '../stores/ai-config-store'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/utils/encryption-utils'

const prisma = new PrismaClient()

/**
 * 获取默认AI模型配置
 * @returns 默认AI模型配置，如果没有则返回null
 */
export async function getAIConfig(id: string): Promise<AIModelConfig | null> {
  try {
    console.log('获取 AI 配置:', id)
    const response = await fetch(`/api/ai-config/${id}`)
    
    if (!response.ok) {
      throw new Error(`获取配置失败: ${response.status}`)
    }

    const config = await response.json()
    if (!config) {
      console.log('未找到配置')
      return null
    }

    console.log('成功获取配置')
    return config
  } catch (error) {
    console.error('获取配置时出错:', error)
    throw error
  }
}

/**
 * 设置默认AI模型配置
 * @param config 要设置为默认的配置
 */
export const setAIConfig = async (config: AIModelConfig) => {
  const store = useAIConfigStore.getState()
  
  // 为配置生成ID（如果没有）
  const configToSet = {
    ...config,
    id: config.id || `default-${Date.now()}`,
    isDefault: true,
    apiKey: await encrypt(config.apiKey)
  }
  
  // 更新数据库中当前默认配置的isDefault字段为false
  await prisma.aIModelConfig.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  })

  // 更新数据库中新的默认配置的isDefault字段为true
  await prisma.aIModelConfig.update({
    where: { id: configToSet.id },
    data: { isDefault: true },
  })

  // 如果已存在，则更新；否则添加
  if (store.configs.some(c => c.id === configToSet.id)) {
    store.updateConfig(configToSet.id, configToSet)
  } else {
    store.addConfig(configToSet)
  }

  console.log('默认配置已更新到数据库')
}

/**
 * 获取所有AI模型配置
 * @returns 所有配置数组
 */
export async function getAllAIConfigs(): Promise<AIModelConfig[]> {
  try {
    console.log('获取所有 AI 配置')
    const response = await fetch('/api/ai-config')
    
    if (!response.ok) {
      throw new Error(`获取配置列表失败: ${response.status}`)
    }

    const configs = await response.json()
    console.log('成功获取配置列表')
    return configs
  } catch (error) {
    console.error('获取配置列表时出错:', error)
    throw error
  }
}

/**
 * 根据ID获取特定配置
 * @param id 配置ID
 * @returns 配置对象，如果不存在则返回null
 */
export const getConfigById = async (id: string): Promise<AIModelConfig | null> => {
  const configs = useAIConfigStore.getState().configs
  const config = configs.find(c => c.id === id)
  if (config) {
    return {
      ...config,
      apiKey: await decrypt(config.apiKey)
    }
  }
  return null
}

/**
 * 添加新的AI模型配置
 * @param config 要添加的配置
 */
export async function addAIConfig(config: AIModelConfig): Promise<AIModelConfig> {
  try {
    console.log('添加新的 AI 配置')
    
    // 加密 API Key
    const encryptedApiKey = await encrypt(config.apiKey)
    const configWithEncryptedKey = {
      ...config,
      apiKey: encryptedApiKey
    }

    const response = await fetch('/api/ai-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configWithEncryptedKey)
    })

    if (!response.ok) {
      throw new Error(`添加配置失败: ${response.status}`)
    }

    const savedConfig = await response.json()
    console.log('成功添加配置')
    return savedConfig
  } catch (error) {
    console.error('添加配置时出错:', error)
    throw error
  }
}

/**
 * 更新已有的AI模型配置
 * @param id 配置ID
 * @param config 更新后的配置对象
 */
export async function updateAIConfig(config: AIModelConfig): Promise<AIModelConfig> {
  try {
    console.log('更新 AI 配置:', config.id)
    
    // 加密 API Key
    const encryptedApiKey = await encrypt(config.apiKey)
    const configWithEncryptedKey = {
      ...config,
      apiKey: encryptedApiKey
    }

    const response = await fetch(`/api/ai-config/${config.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configWithEncryptedKey)
    })

    if (!response.ok) {
      throw new Error(`更新配置失败: ${response.status}`)
    }

    const updatedConfig = await response.json()
    console.log('成功更新配置')
    return updatedConfig
  } catch (error) {
    console.error('更新配置时出错:', error)
    throw error
  }
}

/**
 * 删除AI模型配置
 * @param id 要删除的配置ID
 */
export async function deleteAIConfig(id: string): Promise<void> {
  try {
    console.log('删除 AI 配置:', id)
    const response = await fetch(`/api/ai-config/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`删除配置失败: ${response.status}`)
    }

    console.log('成功删除配置')
  } catch (error) {
    console.error('删除配置时出错:', error)
    throw error
  }
}

/**
 * 设置默认AI模型配置
 * @param id 要设为默认的配置ID
 */
export async function setDefaultAIConfig(id: string): Promise<void> {
  try {
    console.log('设置默认 AI 配置:', id)
    const response = await fetch(`/api/ai-config/${id}/default`, {
      method: 'PATCH'
    })

    if (!response.ok) {
      throw new Error(`设置默认配置失败: ${response.status}`)
    }

    console.log('成功设置默认配置')
  } catch (error) {
    console.error('设置默认配置时出错:', error)
    throw error
  }
}

export async function getDefaultAIConfig(): Promise<AIModelConfig | null> {
  try {
    console.log('获取默认 AI 配置')
    const response = await fetch('/api/ai-config/default')
    
    if (!response.ok) {
      throw new Error(`获取默认配置失败: ${response.status}`)
    }

    const config = await response.json()
    if (!config) {
      console.log('未找到默认配置')
      return null
    }

    console.log('成功获取默认配置')
    return config
  } catch (error) {
    console.error('获取默认配置时出错:', error)
    throw error
  }
} 