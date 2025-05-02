/**
 * AI配置数据库服务
 * 此服务用于后端与数据库交互，管理AI模型配置
 */

import { type Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/utils/encryption-utils';
import type { AIModelConfig } from './ai-service';

// 创建Prisma客户端
// const prisma = new PrismaClient();

/**
 * 将数据库模型转换为AIModelConfig
 * @param dbModel 数据库模型
 * @returns 配置对象（API密钥保持加密状态）
 */
function convertToAIModelConfig(dbModel: any): AIModelConfig {
  // 直接返回配置，保持API密钥的加密状态
  return {
    id: dbModel.id,
    name: dbModel.name,
    baseURL: dbModel.baseURL,
    apiKey: dbModel.apiKey, // 保持加密状态
    model: dbModel.model,
    temperature: dbModel.temperature,
    isDefault: dbModel.isDefault,
    type: dbModel.type || 'language', // 添加模型类型
    createdAt: dbModel.createdAt ? dbModel.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: dbModel.updatedAt ? dbModel.updatedAt.toISOString() : new Date().toISOString()
  };
}

/**
 * AI模型配置服务对象
 */
export const aiModelConfigService = {
  /**
   * 获取所有AI模型配置
   * 返回带加密API密钥的完整配置列表
   */
  async getAllConfigs(): Promise<AIModelConfig[]> {
    try {
      // 从数据库获取所有配置
      const configs = await prisma.aIModelConfig.findMany({
        orderBy: {
          createdAt: 'asc'
        }
      });

      // 直接转换配置（保持API密钥加密状态）
      return configs.map((config: any) => convertToAIModelConfig(config));
    } catch (error) {
      console.error('获取所有配置失败:', error);
      return [];
    }
  },

  /**
   * 根据ID获取配置
   * 返回带加密API密钥的完整配置
   */
  async getConfigById(id: string): Promise<AIModelConfig | null> {
    try {
      const config = await prisma.aIModelConfig.findUnique({
        where: { id }
      });

      if (!config) {
        console.log('未找到指定配置:', id);
        return null;
      }

      console.log('获取到配置:', {
        id: config.id,
        model: config.model,
        hasApiKey: !!config.apiKey,
        apiKeyLength: config.apiKey?.length || 0
      });

      // 直接转换配置（保持API密钥加密状态）
      return convertToAIModelConfig(config);
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  },

  /**
   * 获取所有指定类型的AI模型配置
   */
  async getConfigsByType(type: string = 'language'): Promise<AIModelConfig[]> {
    try {
      // 从数据库获取指定类型的配置
      const configs = await prisma.aIModelConfig.findMany({
        where: { 
          type 
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      // 直接转换配置（保持API密钥加密状态）
      return configs.map((config: any) => convertToAIModelConfig(config));
    } catch (error) {
      console.error(`获取${type}类型配置失败:`, error);
      return [];
    }
  },

  /**
   * 根据类型获取默认配置
   */
  async getDefaultConfigByType(type: string = 'language'): Promise<AIModelConfig | null> {
    try {
      console.log(`开始从数据库获取${type}类型的默认配置`);
      
      const config = await prisma.aIModelConfig.findFirst({
        where: { 
          isDefault: true,
          type: type
        }
      });

      if (!config) {
        console.log(`数据库中未找到${type}类型的默认配置`);
        return null;
      }

      // 直接转换配置（保持API密钥加密状态）
      return convertToAIModelConfig(config);
    } catch (error) {
      console.error(`获取${type}类型默认配置失败:`, error);
      return null;
    }
  },

  /**
   * 获取默认配置
   * 返回带加密API密钥的完整配置
   * 为兼容现有代码，默认返回语言模型类型的默认配置
   */
  async getDefaultConfig(): Promise<AIModelConfig | null> {
    try {
      console.log('开始从数据库获取默认语言模型配置');
      
      const config = await prisma.aIModelConfig.findFirst({
        where: { 
          isDefault: true,
          type: 'language'  // 指定获取语言模型类型
        }
      });

      if (!config) {
        console.log('数据库中未找到默认语言模型配置');
        return null;
      }

      console.log('从数据库获取到原始配置:', {
        id: config.id,
        model: config.model,
        hasApiKey: !!config.apiKey,
        apiKeyLength: config.apiKey?.length || 0
      });

      // 直接转换配置（保持API密钥加密状态）
      const convertedConfig = convertToAIModelConfig(config);
      
      console.log('转换后的配置:', {
        id: convertedConfig.id,
        model: convertedConfig.model,
        hasApiKey: !!convertedConfig.apiKey,
        apiKeyLength: convertedConfig.apiKey?.length || 0
      });

      return convertedConfig;
    } catch (error) {
      console.error('获取默认语言模型配置失败:', error);
      return null;
    }
  },

  /**
   * 获取默认视觉模型配置
   * 返回带加密API密钥的完整配置
   */
  async getDefaultVisionConfig(): Promise<AIModelConfig | null> {
    try {
      console.log('开始从数据库获取默认视觉模型配置');
      
      const config = await prisma.aIModelConfig.findFirst({
        where: { 
          isDefault: true,
          type: 'vision'  // 指定获取视觉模型类型
        }
      });

      if (!config) {
        console.log('数据库中未找到默认视觉模型配置');
        return null;
      }

      console.log('从数据库获取到默认视觉模型配置:', {
        id: config.id,
        model: config.model,
        hasApiKey: !!config.apiKey,
        apiKeyLength: config.apiKey?.length || 0
      });

      // 直接转换配置（保持API密钥加密状态）
      return convertToAIModelConfig(config);
    } catch (error) {
      console.error('获取默认视觉模型配置失败:', error);
      return null;
    }
  },

  /**
   * 添加新配置
   * 注意：入参中的API密钥是明文，会在此方法中加密存储
   */
  async addConfig(config: Omit<AIModelConfig, 'id'>): Promise<AIModelConfig> {
    try {
      // 加密API密钥
      const encryptedApiKey = await encrypt(config.apiKey);

      // 确定类型
      const type = config.type || 'language';

      // 检查是否该类型的第一个配置
      const configCount = await prisma.aIModelConfig.count({
        where: { type }
      });
      const isDefault = configCount === 0 ? true : !!config.isDefault;

      // 如果将要添加的配置设置为默认，先取消同类型的其他默认配置
      if (isDefault) {
        await prisma.aIModelConfig.updateMany({
          where: { 
            isDefault: true,
            type: type
          },
          data: { isDefault: false }
        });
      }

      // 添加新配置
      const newConfig = await prisma.aIModelConfig.create({
        data: {
          name: config.name,
          baseURL: config.baseURL,
          apiKey: encryptedApiKey,
          model: config.model,
          temperature: config.temperature ?? 0.7,
          isDefault: isDefault,
          type: type,
        }
      });

      // 返回转换后的配置对象，API密钥已加密
      const result = convertToAIModelConfig(newConfig);
      
      // 为了前端界面展示，返回明文API密钥
      return {
        ...result,
        apiKey: config.apiKey
      };
    } catch (error) {
      console.error('添加配置失败:', error);
      throw error;
    }
  },

  /**
   * 更新配置
   * 注意：如果提供了新的API密钥，它是明文，会被加密存储
   */
  async updateConfig(id: string, config: Partial<AIModelConfig>): Promise<AIModelConfig> {
    try {
      // 获取当前配置以获取类型信息
      const currentConfig = await prisma.aIModelConfig.findUnique({
        where: { id }
      });

      if (!currentConfig) {
        throw new Error('配置不存在');
      }

      // 准备更新数据
      const updateData: any = { ...config };
      
      // 确保temperature值为0时也能正确处理
      if (config.temperature !== undefined) {
        updateData.temperature = config.temperature;
      }

      // 如果提供了API密钥，进行加密
      if (config.apiKey) {
        updateData.apiKey = await encrypt(config.apiKey);
      }

      // 确定类型
      const type = config.type || currentConfig.type || 'language';

      // 如果设置为默认，先取消同类型的其他默认配置
      if (config.isDefault) {
        await prisma.aIModelConfig.updateMany({
          where: { 
            isDefault: true,
            type: type,
            id: { not: id }
          },
          data: { isDefault: false }
        });
      }

      // 更新配置
      const updatedConfig = await prisma.aIModelConfig.update({
        where: { id },
        data: updateData
      });

      // 返回更新后的配置，API密钥保持加密状态
      const result = convertToAIModelConfig(updatedConfig);
      
      // 如果提供了新的API密钥，为了前端展示返回明文
      if (config.apiKey) {
        return {
          ...result,
          apiKey: config.apiKey
        };
      }
      
      return result;
    } catch (error) {
      console.error('更新配置失败:', error);
      throw error;
    }
  },

  /**
   * 删除配置
   */
  async deleteConfig(id: string): Promise<void> {
    try {
      // 检查是否是默认配置
      const config = await prisma.aIModelConfig.findUnique({
        where: { id }
      });

      if (!config) {
        console.log('要删除的配置不存在:', id);
        return;
      }

      const wasDefault = config.isDefault;

      // 如果是默认配置，先找到新的默认配置
      if (wasDefault) {
        const remainingConfig = await prisma.aIModelConfig.findFirst({
          where: { 
            id: { not: id }
          },
          orderBy: { createdAt: 'asc' }
        });

        if (remainingConfig) {
          // 先设置新的默认配置
          await prisma.aIModelConfig.update({
            where: { id: remainingConfig.id },
            data: { isDefault: true }
          });
        }
      }

      // 删除配置
      await prisma.aIModelConfig.delete({
        where: { id }
      });

      console.log(`配置已删除 (ID: ${id}), 是否为默认配置: ${wasDefault}`);
    } catch (error) {
      console.error('删除配置失败:', error);
      throw error;
    }
  },

  /**
   * 设置默认配置
   */
  async setDefaultConfig(id: string): Promise<AIModelConfig> {
    try {
      // 获取当前配置以获取类型信息
      const currentConfig = await prisma.aIModelConfig.findUnique({
        where: { id }
      });

      if (!currentConfig) {
        throw new Error('配置不存在');
      }
      
      const type = currentConfig.type || 'language';

      // 先取消同类型的默认配置
      await prisma.aIModelConfig.updateMany({
        where: { 
          isDefault: true,
          type: type
        },
        data: { isDefault: false }
      });

      // 设置新的默认配置
      const updatedConfig = await prisma.aIModelConfig.update({
        where: { id },
        data: { isDefault: true }
      });

      // 返回配置，API密钥保持加密状态
      return convertToAIModelConfig(updatedConfig);
    } catch (error) {
      console.error('设置默认配置失败:', error);
      throw error;
    }
  }
}; 