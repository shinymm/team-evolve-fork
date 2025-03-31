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

/**
 * 从服务器同步AI配置到store
 * 优化：异步处理Redis同步，不阻塞UI
 */
export const syncLocalStorage = async (): Promise<AIModelConfig[]> => {
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
    
    // 更新store
    const store = useAIConfigStore.getState();
    configs.forEach(config => {
      if (store.configs.some(c => c.id === config.id)) {
        store.updateConfig(config.id, config);
      } else {
        store.addConfig(config);
      }
    });
    
    // 触发Redis同步，但不等待完成
    syncRedisWithLocalStorage().catch((err: unknown) => 
      console.error('Redis同步失败:', err)
    );
    
    return configs;
  } catch (error) {
    console.error('同步配置失败:', error);
    return [];
  }
};

/**
 * 从store获取AI配置
 */
export const getAIConfigs = (): AIModelConfig[] => {
  return useAIConfigStore.getState().configs;
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
 * 优化：采用乐观更新策略，立即更新store
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
  
  // 获取store
  const store = useAIConfigStore.getState();
  
  // 如果是第一个配置，设置为默认
  if (store.configs.length === 0) {
    newConfig.isDefault = true;
  }
  
  // 乐观更新store
  store.addConfig(newConfig);
  
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
      // 如果请求失败，回滚store更改
      store.deleteConfig(tempId);
      throw new Error('添加配置失败');
    }

    const { config: savedConfig } = await response.json();
    
    // 更新store中的配置
    store.updateConfig(tempId, savedConfig);
    
    return savedConfig;
  } catch (error) {
    // 发生错误时回滚store更改
    store.deleteConfig(tempId);
    throw error;
  }
};

/**
 * 更新AI配置
 * 优化：采用乐观更新策略，立即更新store
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
  
  // 乐观更新store
  const store = useAIConfigStore.getState();
  store.updateConfig(config.id, updatedConfig);
  
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
      // 如果请求失败，回滚store更改
      store.updateConfig(config.id, originalConfig);
      throw new Error('更新配置失败');
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
    // 发生错误时回滚store更改
    store.updateConfig(config.id, originalConfig);
    throw error;
  }
};

/**
 * 删除AI配置
 * 优化：采用乐观更新策略，立即更新store
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
  
  // 乐观更新store
  const store = useAIConfigStore.getState();
  store.deleteConfig(id);
  
  try {
    // 发送请求到服务器
    const response = await fetch(`/api/ai-config/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      // 如果请求失败，回滚store更改
      store.addConfig(deletedConfig);
      throw new Error('删除配置失败');
    }
    
    // 解析响应，确保成功
    const data = await response.json();
    console.log('删除响应:', data);
    
    if (!data || !data.success) {
      console.error('删除响应格式错误:', data);
      throw new Error('服务器返回数据格式不正确');
    }
    
    // 如果选择了新的默认配置，设置默认配置
    if (wasDefault && store.configs.length > 0) {
      store.updateConfig(store.configs[0].id, store.configs[0]);
      fetch(`/api/ai-config/${store.configs[0].id}/default`, {
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
    // 发生错误时回滚store更改
    store.addConfig(deletedConfig);
    throw error;
  }
};

/**
 * 设置默认的AI配置
 * 优化：采用乐观更新策略，立即更新store
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
  
  // 乐观更新store
  const store = useAIConfigStore.getState();
  const updatedConfigs = configs.map(config => ({
    ...config,
    isDefault: config.id === id,
  }));
  
  // 逐个更新配置
  updatedConfigs.forEach(config => {
    store.updateConfig(config.id, config);
  });
  
  try {
    // 发送请求到服务器
    const response = await fetch(`/api/ai-config/${id}/default`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      // 如果请求失败，回滚store更改
      originalConfigs.forEach(config => {
        store.updateConfig(config.id, config);
      });
      throw new Error('设置默认配置失败');
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
    // 发生错误时回滚store更改
    originalConfigs.forEach(config => {
      store.updateConfig(config.id, config);
    });
    throw error;
  }
};

/**
 * 获取默认AI模型配置
 * @returns 默认配置对象
 */
export async function getDefaultAIConfig(): Promise<AIModelConfig | null> {
  try {
    console.log('开始获取默认 AI 配置')
    
    // 1. 先尝试从Redis获取
    if (isServer && redisUtils) {
      console.log('尝试从Redis获取默认配置...')
      const defaultId = await redisUtils.getDefaultConfigIdFromRedis()
      
      if (defaultId) {
        console.log('在Redis中找到默认配置ID:', defaultId)
        const config = await redisUtils.getConfigFromRedis(defaultId)
        if (config) {
          console.log('成功从Redis获取默认配置:', {
            id: config.id,
            model: config.model,
            baseURL: config.baseURL,
            hasApiKey: !!config.apiKey,
            apiKeyLength: config.apiKey?.length || 0
          })
          return config
        }
      }
      console.log('Redis中未找到默认配置,尝试从数据库获取')
    }

    // 2. Redis没有,从数据库获取
    const response = await fetch('/api/ai-config/default')
    
    if (!response.ok) {
      throw new Error(`获取默认配置失败: ${response.status}`)
    }

    const config = await response.json()
    if (!config) {
      console.log('数据库中未找到默认配置')
      return null
    }
    
    console.log('从数据库获取到默认配置:', {
      id: config.id,
      model: config.model,
      baseURL: config.baseURL,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0
    })
    
    // 3. 如果从数据库获取成功,同步到Redis
    if (isServer && redisUtils && config) {
      console.log('同步默认配置到Redis...')
      try {
        await redisUtils.saveConfigToRedis(config)
        await redisUtils.setDefaultConfigInRedis(config.id)
        console.log('成功同步默认配置到Redis')
      } catch (redisError) {
        console.error('同步到Redis失败:', redisError)
        // 同步失败不影响返回结果
      }
    }
    
    return config
  } catch (error) {
    console.error('获取默认配置时出错:', error)
    throw error
  }
} 