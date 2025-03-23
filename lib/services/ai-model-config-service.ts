/**
 * AI模型配置服务
 * 此服务用于与数据库交互，管理AI模型配置
 */

import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '@/lib/utils/encryption-utils';
import type { AIModelConfig } from './ai-service';

// 创建Prisma客户端
const prisma = new PrismaClient();

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
      return configs.map(config => convertToAIModelConfig(config));
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
        return null;
      }

      // 直接转换配置（保持API密钥加密状态）
      return convertToAIModelConfig(config);
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  },

  /**
   * 获取默认配置
   * 返回带加密API密钥的完整配置
   */
  async getDefaultConfig(): Promise<AIModelConfig | null> {
    try {
      const config = await prisma.aIModelConfig.findFirst({
        where: { isDefault: true }
      });

      if (!config) {
        return null;
      }

      // 直接转换配置（保持API密钥加密状态）
      return convertToAIModelConfig(config);
    } catch (error) {
      console.error('获取默认配置失败:', error);
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

      // 如果是第一个配置，设置为默认
      const configCount = await prisma.aIModelConfig.count();
      const isDefault = configCount === 0 ? true : !!config.isDefault;

      // 如果将要添加的配置设置为默认，先取消其他默认配置
      if (isDefault) {
        await prisma.aIModelConfig.updateMany({
          where: { isDefault: true },
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
          temperature: config.temperature || 0.7,
          isDefault: isDefault,
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
      // 准备更新数据
      const updateData: any = {
        ...config,
      };

      // 如果提供了API密钥，进行加密
      if (config.apiKey) {
        updateData.apiKey = await encrypt(config.apiKey);
      }

      // 如果设置为默认，先取消其他默认配置
      if (config.isDefault) {
        await prisma.aIModelConfig.updateMany({
          where: { 
            isDefault: true,
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

      // 删除配置
      await prisma.aIModelConfig.delete({
        where: { id }
      });

      // 如果删除的是默认配置，需要设置新的默认配置
      if (config?.isDefault) {
        const remainingConfig = await prisma.aIModelConfig.findFirst({
          orderBy: { createdAt: 'asc' }
        });

        if (remainingConfig) {
          await prisma.aIModelConfig.update({
            where: { id: remainingConfig.id },
            data: { isDefault: true }
          });
        }
      }
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
      // 先取消所有默认配置
      await prisma.aIModelConfig.updateMany({
        where: { isDefault: true },
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