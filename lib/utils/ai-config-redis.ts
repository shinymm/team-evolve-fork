import type { AIModelConfig } from '../services/ai-service';
import { getRedisClient } from '../redis';

// Redis键前缀，用于避免键冲突
const AI_CONFIG_PREFIX = 'ai:config:';
const DEFAULT_CONFIG_KEY = 'ai:config:default';

// 使用一次性连接获取redis实例
const getRedis = () => getRedisClient();

/**
 * 保存单个AI模型配置到Redis
 * Redis只存储加密后的API密钥，不进行解密操作
 * 调用此函数前确保传入的配置中的apiKey已经是加密状态
 */
export async function saveConfigToRedis(config: AIModelConfig): Promise<void> {
  try {
    const redis = getRedis();
    const configKey = `${AI_CONFIG_PREFIX}${config.id}`;
    
    // 确保apiKey是加密状态，如果是明文则返回错误
    if (config.apiKey && config.apiKey.length < 30) {
      console.warn('警告: 可能尝试保存未加密的API密钥到Redis，建议先加密');
    }
    
    // 使用pipeline合并多个操作
    const pipeline = redis.pipeline();
    
    // 将配置对象序列化为JSON
    pipeline.set(configKey, JSON.stringify(config));
    
    // 如果是默认配置，更新默认配置键
    if (config.isDefault) {
      pipeline.set(DEFAULT_CONFIG_KEY, config.id);
    }
    
    // 执行批量操作
    await pipeline.exec();
  } catch (error) {
    console.error('保存配置到Redis失败:', error);
    // 不抛出异常，允许应用继续运行
  }
}

/**
 * 从Redis获取单个AI模型配置
 * 注意：返回的配置包含加密后的API密钥，不进行解密
 * 如需使用API密钥，调用方需要负责解密
 */
export async function getConfigFromRedis(id: string): Promise<AIModelConfig | null> {
  try {
    const redis = getRedis();
    const configKey = `${AI_CONFIG_PREFIX}${id}`;
    
    const configJson = await redis.get(configKey);
    if (!configJson) {
      return null;
    }
    
    // 返回原始配置，包含加密的API密钥
    return JSON.parse(configJson) as AIModelConfig;
  } catch (error) {
    console.error('从Redis获取配置失败:', error);
    return null;
  }
}

/**
 * 从Redis删除单个AI模型配置
 * 优化的实现，使用pipeline并后台处理
 */
export async function deleteConfigFromRedis(id: string): Promise<void> {
  try {
    const redis = getRedis();
    const configKey = `${AI_CONFIG_PREFIX}${id}`;
    
    // 检查是否是默认配置
    const defaultConfigId = await redis.get(DEFAULT_CONFIG_KEY);
    const isDefault = defaultConfigId === id;
    
    // 使用pipeline合并操作
    const pipeline = redis.pipeline();
    
    // 删除配置
    pipeline.del(configKey);
    
    // 如果删除的是默认配置，清除默认配置键
    if (isDefault) {
      pipeline.del(DEFAULT_CONFIG_KEY);
    }
    
    // 执行批量操作
    await pipeline.exec();
    
    // 如果删除的是默认配置，选择新的默认配置
    if (isDefault) {
      // 获取所有剩余的配置
      const keys = await redis.keys(`${AI_CONFIG_PREFIX}*`);
      const configKeys = keys.filter(key => key !== DEFAULT_CONFIG_KEY);
      
      if (configKeys.length > 0) {
        // 获取第一个配置作为新的默认配置
        configKeys.sort();
        const firstConfigKey = configKeys[0];
        const newDefaultId = firstConfigKey.replace(AI_CONFIG_PREFIX, '');
        
        // 设置为默认，使用异步操作不等待完成
        setDefaultConfigInRedis(newDefaultId).catch(err => 
          console.error('设置新默认配置失败:', err)
        );
      }
    }
  } catch (error) {
    console.error('从Redis删除配置失败:', error);
    // 不抛出异常，允许应用继续运行
  }
}

/**
 * 从Redis获取默认配置ID
 */
export async function getDefaultConfigIdFromRedis(): Promise<string | null> {
  try {
    const redis = getRedis();
    const defaultConfigJson = await redis.get(DEFAULT_CONFIG_KEY);
    
    // 如果存储的是完整的配置对象（旧格式），则提取ID
    if (defaultConfigJson && defaultConfigJson.startsWith('{')) {
      try {
        const config = JSON.parse(defaultConfigJson);
        return config.id;
      } catch {
        return null;
      }
    }
    
    return defaultConfigJson;
  } catch (error) {
    console.error('获取默认配置ID失败:', error);
    return null;
  }
}

/**
 * 从Redis获取默认配置
 */
export async function getDefaultConfigFromRedis(): Promise<AIModelConfig | null> {
  try {
    const redis = getRedis();
    
    // 获取默认配置ID
    const defaultId = await getDefaultConfigIdFromRedis();
    if (!defaultId) {
      console.log('Redis中未找到默认配置ID');
      return null;
    }
    
    // 获取默认配置
    const configKey = `${AI_CONFIG_PREFIX}${defaultId}`;
    const configJson = await redis.get(configKey);
    
    if (!configJson) {
      console.log(`Redis中未找到配置: ${configKey}`);
      return null;
    }
    
    try {
      const config = JSON.parse(configJson);
      return config;
    } catch (parseError) {
      console.error('解析配置JSON失败:', parseError);
      return null;
    }
  } catch (error) {
    console.error('获取默认配置失败:', error);
    return null;
  }
}

/**
 * 设置默认AI模型配置
 */
export async function setDefaultConfigInRedis(id: string): Promise<void> {
  try {
    const redis = getRedis();
    
    // 检查配置是否存在
    const configExists = await redis.exists(`${AI_CONFIG_PREFIX}${id}`);
    if (!configExists) {
      console.error(`配置不存在: ${id}`);
      return;
    }
    
    // 使用pipeline合并操作
    const pipeline = redis.pipeline();
    
    // 设置新的默认配置ID
    pipeline.set(DEFAULT_CONFIG_KEY, id);
    
    // 执行批量操作
    await pipeline.exec();
    
    console.log(`已设置默认配置ID: ${id}`);
  } catch (error) {
    console.error('设置默认配置失败:', error);
    // 不抛出异常，允许应用继续运行
  }
}

/**
 * 保存所有AI模型配置到Redis
 */
export async function saveAllConfigsToRedis(configs: AIModelConfig[]): Promise<void> {
  try {
    if (!configs || configs.length === 0) {
      console.log('没有配置需要保存到Redis');
      return;
    }
    
    console.log(`尝试保存${configs.length}个配置到Redis...`, configs.map(c => c.id));
    
    const redis = getRedis();
    const pipeline = redis.pipeline();
    
    // 默认配置ID
    let defaultId: string | null = null;
    
    // 保存每个配置
    for (const config of configs) {
      const configKey = `${AI_CONFIG_PREFIX}${config.id}`;
      console.log(`准备保存配置: ${configKey}`);
      pipeline.set(configKey, JSON.stringify(config));
      
      // 记录默认配置ID
      if (config.isDefault) {
        defaultId = config.id;
      }
    }
    
    // 如果有默认配置，只保存ID
    if (defaultId) {
      console.log(`设置默认配置ID: ${defaultId}`);
      pipeline.set(DEFAULT_CONFIG_KEY, defaultId);
    }
    
    // 执行批量操作
    await pipeline.exec();
    console.log('所有配置已保存到Redis');
  } catch (error) {
    console.error('保存配置到Redis失败:', error);
    throw error;
  }
}

/**
 * 从Redis获取所有AI模型配置
 * 注意：返回的配置包含加密后的API密钥，不进行解密
 */
export async function getAllConfigsFromRedis(): Promise<AIModelConfig[]> {
  try {
    const redis = getRedis();
    
    // 获取所有符合模式的键
    const keys = await redis.keys(`${AI_CONFIG_PREFIX}*`);
    
    // 过滤掉默认配置键
    const configKeys = keys.filter(key => key !== DEFAULT_CONFIG_KEY);
    
    if (configKeys.length === 0) {
      return [];
    }
    
    // 获取所有配置的值
    const configJsons = await redis.mget(configKeys);
    
    // 解析JSON，返回带加密API密钥的配置
    return configJsons
      .filter((json): json is string => json !== null)
      .map(json => JSON.parse(json) as AIModelConfig);
  } catch (error) {
    console.error('获取所有配置失败:', error);
    return [];
  }
}

/**
 * 同步本地存储和Redis中的配置
 * 以Redis为准，更新本地存储
 * 注意：从Redis获取的配置包含加密后的API密钥
 */
export async function syncConfigsFromRedis(): Promise<AIModelConfig[]> {
  try {
    return getAllConfigsFromRedis();
  } catch (error) {
    console.error('同步配置失败:', error);
    return [];
  }
}

/**
 * 清除Redis中的所有AI模型配置
 */
export async function clearRedisConfigs(): Promise<void> {
  try {
    const redis = getRedis();
    
    // 获取所有AI配置相关的键
    const keys = await redis.keys(`${AI_CONFIG_PREFIX}*`);
    keys.push(DEFAULT_CONFIG_KEY); // 添加默认配置键
    
    if (keys.length > 0) {
      // 使用pipeline批量删除所有键
      const pipeline = redis.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
    }
    
    console.log('已清除Redis中的所有AI配置');
  } catch (error) {
    console.error('清除Redis配置失败:', error);
    throw error; // 抛出异常以便调用方处理
  }
} 