import type { AIModelConfig } from './ai-service'
import { useAIConfigStore } from '../stores/ai-config-store'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '@/lib/utils/encryption-utils'
import { v4 as uuidv4 } from 'uuid'
import { syncRedisWithLocalStorage } from './api-service'

// 检测是否在服务器端环境
const isServer = typeof window === 'undefined';

// 仅在服务器端导入Redis相关函数
let redisUtils: typeof import('@/lib/utils/ai-config-redis') | null = null;
if (isServer) {
  // 动态导入，仅在服务器端执行
  import('@/lib/utils/ai-config-redis').then((module) => {
    redisUtils = module;
  });
}

const prisma = new PrismaClient()

// 配置在本地存储中的键
const AI_CONFIGS_KEY = 'ai-configs';

/**
 * 从本地存储同步AI配置
 * 优化：异步处理Redis同步，不阻塞UI
 */
export const syncLocalStorage = async (): Promise<AIModelConfig[]> => {
  // 先清除本地缓存
  localStorage.removeItem(AI_CONFIGS_KEY);
  
  try {
    // 从服务器获取最新配置
    const response = await fetch('/api/ai-config');
    
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = '获取配置失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }
    
    // 获取服务器返回的配置
    const data = await response.json();
    console.log('同步配置响应:', data);
    
    // 确保返回的是数组
    const configs = Array.isArray(data) ? data : [];
    
    // 更新本地存储
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(configs));
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
    
    return configs;
  } catch (error) {
    console.error('同步本地存储失败:', error);
    return [];
  }
};

/**
 * 从本地存储获取AI配置
 */
export const getAIConfigs = (): AIModelConfig[] => {
  const configsJson = localStorage.getItem(AI_CONFIGS_KEY);
  if (!configsJson) {
    return [];
  }
  return JSON.parse(configsJson) as AIModelConfig[];
};

/**
 * 获取默认AI模型配置
 * @param id 配置ID
 * @returns 配置对象（带加密的API密钥）
 */
export async function getAIConfig(id: string): Promise<AIModelConfig | null> {
  try {
    console.log('获取 AI 配置:', id)
    
    // 通过API获取
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
  
  // 保存到Redis
  await fetch('/api/ai-config/sync-redis', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ configs: [configToSet] })
  })
  // 设置为默认配置
  await fetch('/api/ai-config/set-default', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: configToSet.id })
  })

  console.log('默认配置已更新到数据库和Redis')
}

/**
 * 获取所有AI模型配置
 * @returns 所有配置数组
 */
export async function getAllAIConfigs(): Promise<AIModelConfig[]> {
  try {
    console.log('获取所有 AI 配置')
    
    // 通过API获取
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
  // 通过API获取
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
}

/**
 * 添加新的AI配置
 * 优化：采用乐观更新策略，立即更新UI
 */
export const addAIConfig = async (config: Omit<AIModelConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIModelConfig> => {
  // 生成临时ID
  const tempId = uuidv4();
  
  // 创建完整配置对象
  const newConfig: AIModelConfig = {
    ...config,
    id: tempId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // 获取当前配置
  const configs = getAIConfigs();
  
  // 如果是第一个配置，设置为默认
  if (configs.length === 0) {
    newConfig.isDefault = true;
  }
  
  // 乐观更新UI，立即在本地添加新配置
  const updatedConfigs = [...configs, newConfig];
  localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(updatedConfigs));
  
  try {
    // 发送请求到服务器
    const response = await fetch('/api/ai-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newConfig),
    });
    
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = '添加配置失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }
    
    // 获取服务器返回的配置（包含正确的ID）
    const data = await response.json();
    console.log('服务器响应:', data);
    
    // 检查响应格式 - 应该包含success和config字段
    if (!data || (typeof data.success !== 'boolean')) {
      console.error('API响应格式错误:', data);
      throw new Error('服务器返回的数据格式不正确');
    }
    
    const savedConfig = data.config as AIModelConfig;
    if (!savedConfig || !savedConfig.id) {
      console.error('API响应中缺少配置数据:', data);
      throw new Error('服务器返回的配置数据不完整');
    }
    
    // 更新本地存储中的配置，替换临时ID
    const finalConfigs = getAIConfigs().map(c => 
      c.id === tempId ? savedConfig : c
    );
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(finalConfigs));
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
    
    return savedConfig;
  } catch (error) {
    console.error('添加配置失败:', error);
    
    // 回滚本地状态
    const originalConfigs = getAIConfigs().filter(c => c.id !== tempId);
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(originalConfigs));
    
    throw error;
  }
};

/**
 * 更新AI配置
 * 优化：采用乐观更新策略，立即更新UI
 */
export const updateAIConfig = async (config: AIModelConfig): Promise<AIModelConfig> => {
  // 获取当前的配置列表
  const configs = getAIConfigs();
  
  // 找到要更新的配置索引
  const configIndex = configs.findIndex(c => c.id === config.id);
  if (configIndex === -1) {
    throw new Error('找不到要更新的配置');
  }
  
  // 备份原始配置用于回滚
  const originalConfig = { ...configs[configIndex] };
  
  // 准备更新的配置
  const updatedConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  
  // 乐观更新UI，立即在本地更新配置
  configs[configIndex] = updatedConfig;
  localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(configs));
  
  try {
    // 发送请求到服务器
    const response = await fetch(`/api/ai-config/${config.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedConfig),
    });
    
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = '更新配置失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }
    
    // 获取服务器返回的配置
    const data = await response.json();
    console.log('服务器响应:', data);
    
    // 检查响应格式 - 应该包含success和config字段
    if (!data || (typeof data.success !== 'boolean')) {
      console.error('API响应格式错误:', data);
      throw new Error('服务器返回的数据格式不正确');
    }
    
    const savedConfig = data.config as AIModelConfig;
    if (!savedConfig || !savedConfig.id) {
      console.error('API响应中缺少配置数据:', data);
      throw new Error('服务器返回的配置数据不完整');
    }
    
    // 如果是默认配置，设置默认配置
    if (savedConfig.isDefault) {
      fetch(`/api/ai-config/${savedConfig.id}/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      }).catch((err: unknown) => console.error('设置默认配置失败:', err));
    }
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
    
    return savedConfig;
  } catch (error) {
    console.error('更新配置失败:', error);
    
    // 回滚本地状态
    configs[configIndex] = originalConfig;
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(configs));
    
    throw error;
  }
};

/**
 * 删除AI配置
 * 优化：采用乐观更新策略，立即更新UI
 */
export const deleteAIConfig = async (id: string): Promise<void> => {
  // 获取当前的配置列表
  const configs = getAIConfigs();
  
  // 找到要删除的配置
  const configIndex = configs.findIndex(c => c.id === id);
  if (configIndex === -1) {
    throw new Error('找不到要删除的配置');
  }
  
  // 备份配置列表用于回滚
  const originalConfigs = [...configs];
  const deletedConfig = configs[configIndex];
  const wasDefault = deletedConfig.isDefault;
  
  // 乐观更新UI，立即从本地删除配置
  const updatedConfigs = configs.filter(c => c.id !== id);
  
  // 如果删除的是默认配置，需要选择新的默认配置
  if (wasDefault && updatedConfigs.length > 0) {
    // 选择第一个配置作为新的默认配置
    updatedConfigs[0].isDefault = true;
  }
  
  localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(updatedConfigs));
  
  try {
    // 发送请求到服务器
    const response = await fetch(`/api/ai-config/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = '删除配置失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }
    
    // 解析响应，确保成功
    const data = await response.json();
    console.log('删除响应:', data);
    
    if (!data || !data.success) {
      console.error('删除响应格式错误:', data);
      throw new Error('服务器返回数据格式不正确');
    }
    
    // 如果选择了新的默认配置，设置默认配置
    if (wasDefault && updatedConfigs.length > 0) {
      fetch(`/api/ai-config/${updatedConfigs[0].id}/default`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      }).catch((err: unknown) => console.error('设置默认配置失败:', err));
    }
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
  } catch (error) {
    console.error('删除配置失败:', error);
    
    // 回滚本地状态
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(originalConfigs));
    
    throw error;
  }
};

/**
 * 设置默认的AI配置
 * 优化：采用乐观更新策略，立即更新UI
 */
export const setDefaultAIConfig = async (id: string): Promise<AIModelConfig> => {
  // 获取当前的配置列表
  const configs = getAIConfigs();
  
  // 找到要设置为默认的配置
  const configIndex = configs.findIndex(c => c.id === id);
  if (configIndex === -1) {
    throw new Error('找不到要设置为默认的配置');
  }
  
  // 备份配置列表用于回滚
  const originalConfigs = JSON.parse(JSON.stringify(configs)) as AIModelConfig[];
  
  // 乐观更新UI，立即在本地更新默认配置
  const updatedConfigs = configs.map(config => ({
    ...config,
    isDefault: config.id === id,
  }));
  
  localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(updatedConfigs));
  
  try {
    // 发送请求到服务器
    const response = await fetch(`/api/ai-config/${id}/default`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      // 尝试解析错误信息
      let errorMessage = '设置默认配置失败';
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      throw new Error(errorMessage);
    }
    
    // 解析响应
    const data = await response.json();
    console.log('设置默认响应:', data);
    
    // 检查响应格式 - 应该包含success字段
    if (!data || (typeof data.success !== 'boolean')) {
      console.error('API响应格式错误:', data);
      throw new Error('服务器返回的数据格式不正确');
    }
    
    const savedConfig = data.config as AIModelConfig;
    if (!savedConfig || !savedConfig.id) {
      console.error('API响应中缺少配置数据:', data);
      throw new Error('服务器返回的配置数据不完整');
    }
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
    
    return savedConfig;
  } catch (error) {
    console.error('设置默认配置失败:', error);
    
    // 回滚本地状态
    localStorage.setItem(AI_CONFIGS_KEY, JSON.stringify(originalConfigs));
    
    throw error;
  }
};

/**
 * 获取默认AI模型配置
 * @returns 默认配置对象
 */
export async function getDefaultAIConfig(): Promise<AIModelConfig | null> {
  try {
    console.log('获取默认 AI 配置')
    
    // 通过API获取
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