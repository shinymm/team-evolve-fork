import type { AIModelConfig } from './ai-service'

/**
 * 获取AI模型配置
 * @param id 配置ID
 * @returns 配置对象
 */
export async function getAIConfig(id: string): Promise<AIModelConfig | null> {
  try {
    const response = await fetch(`/api/ai-config/${id}`)
    
    if (!response.ok) {
      throw new Error(`获取配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config || null
  } catch (error) {
    console.error('获取配置时出错:', error)
    throw error
  }
}

/**
 * 获取所有AI模型配置
 * @returns 所有配置数组
 */
export async function getAllAIConfigs(): Promise<AIModelConfig[]> {
  try {
    const response = await fetch('/api/ai-config')
    
    if (!response.ok) {
      throw new Error(`获取配置列表失败: ${response.status}`)
    }

    const data = await response.json()
    return data.configs || []
  } catch (error) {
    console.error('获取配置列表时出错:', error)
    throw error
  }
}

/**
 * 添加新的AI配置
 */
export const addAIConfig = async (config: Omit<AIModelConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIModelConfig> => {
  try {
    const response = await fetch('/api/ai-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      throw new Error(`添加配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config
  } catch (error) {
    console.error('添加配置时出错:', error)
    throw error
  }
}

/**
 * 更新AI配置
 */
export const updateAIConfig = async (config: AIModelConfig): Promise<AIModelConfig> => {
  try {
    const response = await fetch(`/api/ai-config/${config.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      throw new Error(`更新配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config
  } catch (error) {
    console.error('更新配置时出错:', error)
    throw error
  }
}

/**
 * 删除AI配置
 */
export const deleteAIConfig = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`/api/ai-config/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`删除配置失败: ${response.status}`)
    }
  } catch (error) {
    console.error('删除配置时出错:', error)
    throw error
  }
}

/**
 * 设置默认AI配置
 */
export const setDefaultAIConfig = async (id: string): Promise<AIModelConfig> => {
  try {
    const response = await fetch(`/api/ai-config/${id}/default`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`设置默认配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config
  } catch (error) {
    console.error('设置默认配置时出错:', error)
    throw error
  }
}

/**
 * 获取默认AI模型配置
 */
export async function getDefaultAIConfig(): Promise<AIModelConfig | null> {
  try {
    const response = await fetch('/api/ai-config/default')
    
    if (!response.ok) {
      throw new Error(`获取默认配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config || null
  } catch (error) {
    console.error('获取默认配置时出错:', error)
    throw error
  }
}

/**
 * 获取所有指定类型的AI模型配置
 * @param type 模型类型
 * @returns 指定类型的配置数组
 */
export async function getAIConfigsByType(type: string = 'language'): Promise<AIModelConfig[]> {
  try {
    const response = await fetch(`/api/ai-config?type=${type}`)
    
    if (!response.ok) {
      throw new Error(`获取${type}类型配置列表失败: ${response.status}`)
    }

    const data = await response.json()
    return data.configs || []
  } catch (error) {
    console.error(`获取${type}类型配置列表时出错:`, error)
    throw error
  }
}

/**
 * 获取指定类型的默认AI模型配置
 * @param type 模型类型
 * @returns 指定类型的默认配置
 */
export async function getDefaultAIConfigByType(type: string = 'language'): Promise<AIModelConfig | null> {
  try {
    const response = await fetch(`/api/ai-config/default?type=${type}`)
    
    if (!response.ok) {
      throw new Error(`获取${type}类型默认配置失败: ${response.status}`)
    }

    const data = await response.json()
    return data.config || null
  } catch (error) {
    console.error(`获取${type}类型默认配置时出错:`, error)
    throw error
  }
} 