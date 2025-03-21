import { useVectorConfigStore } from '../stores/vector-config-store'
import { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from '../utils/encryption-utils'

const prisma = new PrismaClient()

/**
 * 获取默认向量模型配置
 * @returns 默认向量模型配置，如果没有则返回undefined
 */
export async function getVectorConfig(): Promise<VectorModelConfig | undefined> {
  const config = useVectorConfigStore.getState().getDefaultConfig()
  if (config) {
    return {
      ...config,
      apiKey: await decrypt(config.apiKey)
    }
  }
  return undefined
}

/**
 * 设置默认向量模型配置
 * @param config 要设置为默认的配置
 */
export const setVectorConfig = async (config: VectorModelConfig) => {
  const store = useVectorConfigStore.getState()
  
  // 为配置生成ID（如果没有）
  const configToSet = {
    ...config,
    id: config.id || `default-${Date.now()}`,
    isDefault: true,
    apiKey: await encrypt(config.apiKey)
  }
  
  // 更新数据库中当前默认配置的isDefault字段为false
  await prisma.vectorModelConfig.updateMany({
    where: { isDefault: true },
    data: { isDefault: false },
  })

  // 更新数据库中新的默认配置的isDefault字段为true
  await prisma.vectorModelConfig.update({
    where: { id: configToSet.id },
    data: { isDefault: true },
  })

  // 如果已存在，则更新；否则添加
  const existingConfig = store.getConfig(configToSet.id)
  if (existingConfig) {
    store.updateConfig(configToSet.id, configToSet)
  } else {
    store.addConfig(configToSet)
  }

  console.log('默认向量配置已更新到数据库')
}

/**
 * 获取所有向量模型配置
 * @returns 所有配置数组
 */
export const getAllVectorConfigs = async (): Promise<VectorModelConfig[]> => {
  const configs = useVectorConfigStore.getState().configs
  return Promise.all(configs.map(async config => ({
    ...config,
    apiKey: await decrypt(config.apiKey)
  })))
}

/**
 * 根据ID获取特定配置
 * @param id 配置ID
 * @returns 配置对象，如果不存在则返回undefined
 */
export const getVectorConfigById = async (id: string): Promise<VectorModelConfig | undefined> => {
  const config = useVectorConfigStore.getState().getConfig(id)
  if (config) {
    return {
      ...config,
      apiKey: await decrypt(config.apiKey)
    }
  }
  return undefined
}

/**
 * 添加新的向量模型配置
 * @param config 要添加的配置
 */
export const addVectorConfig = async (config: VectorModelConfig) => {
  const encryptedApiKey = await encrypt(config.apiKey)
  const configToAdd = {
    ...config,
    apiKey: encryptedApiKey
  }
  
  useVectorConfigStore.getState().addConfig(configToAdd)

  // 保存到数据库
  await prisma.vectorModelConfig.create({
    data: {
      id: config.id || undefined,
      name: config.name || '默认配置',
      model: config.model,
      baseURL: config.baseURL,
      apiKey: encryptedApiKey,
      dimension: config.dimension,
      isDefault: config.isDefault || false,
      provider: config.provider || '未知',
    },
  })

  console.log('向量配置已保存到数据库')
}

/**
 * 更新已有的向量模型配置
 * @param id 配置ID
 * @param config 更新后的配置对象
 */
export const updateVectorConfig = async (id: string, config: VectorModelConfig) => {
  const encryptedApiKey = await encrypt(config.apiKey)
  const configToUpdate = {
    ...config,
    apiKey: encryptedApiKey
  }
  
  useVectorConfigStore.getState().updateConfig(id, configToUpdate)

  // 更新数据库
  await prisma.vectorModelConfig.update({
    where: { id },
    data: configToUpdate,
  })

  console.log('向量配置已更新到数据库')
}

/**
 * 删除向量模型配置
 * @param id 要删除的配置ID
 */
export const deleteVectorConfig = async (id: string) => {
  useVectorConfigStore.getState().deleteConfig(id)

  // 从数据库删除
  await prisma.vectorModelConfig.delete({
    where: { id },
  })

  console.log('向量配置已从数据库删除')
}

/**
 * 设置默认向量模型配置
 * @param id 要设为默认的配置ID
 */
export const setDefaultVectorConfig = (id: string) => {
  useVectorConfigStore.getState().setDefaultConfig(id)
}

export type VectorModelConfig = {
  id?: string;
  name?: string;
  model: string;
  baseURL: string;
  apiKey: string;
  dimension: number;
  isDefault?: boolean;
  provider?: string;
}; 