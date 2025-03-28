import OpenAI from 'openai'
import fetch from 'node-fetch'
import { useVectorConfigStore } from '../stores/vector-config-store'
import { getAllVectorConfigs } from './vector-config-service'
import { decrypt } from '@/lib/utils/encryption-utils'

// 向量模型配置类型
export type VectorModelConfig = {
  id?: string;
  name?: string;
  baseURL: string;
  model: string;
  apiKey: string;
  isDefault?: boolean;
}

// 服务器端配置存储
let serverSideConfig: VectorModelConfig | null = null

export function setServerSideConfig(config: VectorModelConfig) {
  serverSideConfig = config
}

/**
 * 从 store 获取向量模型配置
 * @returns 向量模型配置数组的 Promise
 */
export async function getVectorConfigs(): Promise<VectorModelConfig[]> {
  try {
    return await getAllVectorConfigs()
  } catch (error) {
    console.error('从 store 加载向量配置失败:', error)
    return []
  }
}

/**
 * 获取默认向量模型配置
 * @returns 默认向量模型配置
 */
export function getDefaultVectorConfig(): VectorModelConfig | null {
  try {
    const config = useVectorConfigStore.getState().getDefaultConfig()
    return config || null
  } catch (error) {
    console.error('获取默认向量配置失败:', error)
    return null
  }
}

/**
 * 将向量转换为指定维度
 * @param vector 原始向量
 * @param targetDim 目标维度
 * @returns 转换后的向量
 */
function resizeVector(vector: number[], targetDim: number): number[] {
  if (vector.length === targetDim) {
    return vector
  }
  
  // 如果原始维度大于目标维度，我们通过平均值降维
  if (vector.length > targetDim) {
    console.log(`将向量从 ${vector.length} 维降至 ${targetDim} 维`)
    const ratio = vector.length / targetDim
    const result = new Array(targetDim)
    
    for (let i = 0; i < targetDim; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.floor((i + 1) * ratio)
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += vector[j]
      }
      result[i] = sum / (end - start)
    }
    
    return result
  }
  
  // 如果原始维度小于目标维度，我们通过线性插值升维
  console.log(`将向量从 ${vector.length} 维升至 ${targetDim} 维`)
  const ratio = (vector.length - 1) / (targetDim - 1)
  const result = new Array(targetDim)
  
  for (let i = 0; i < targetDim; i++) {
    const pos = i * ratio
    const index = Math.floor(pos)
    const fraction = pos - index
    
    if (index >= vector.length - 1) {
      result[i] = vector[vector.length - 1]
    } else {
      result[i] = vector[index] * (1 - fraction) + vector[index + 1] * fraction
    }
  }
  
  return result
}

/**
 * 生成文本的嵌入向量
 * @param text 要生成嵌入的文本
 * @param config 向量模型配置（必须提供）
 * @returns 嵌入向量
 */
export async function getEmbedding(text: string, config?: VectorModelConfig): Promise<number[]> {
  try {
    console.log('开始生成嵌入向量，文本长度:', text.length)
    
    // 必须提供配置
    if (!config) {
      console.error('未提供向量模型配置')
      throw new Error('必须提供向量模型配置')
    }

    const { baseURL, apiKey: encryptedApiKey, model } = config
    console.log('使用配置:', { baseURL, model })
    
    // 尝试解密API Key
    let apiKey = encryptedApiKey
    if (encryptedApiKey.length > 100) {
      console.log('检测到加密的API Key，尝试解密')
      apiKey = await decrypt(encryptedApiKey)
      if (!apiKey) {
        throw new Error('无法解密API Key')
      }
    }
    
    // 提取域名以识别不同服务商
    const domain = new URL(baseURL).hostname
    console.log('服务商域名:', domain)
    
    // 根据不同服务商调用相应的API
    let vector: number[]
    if (domain.includes('openai.com')) {
      console.log('使用 OpenAI API')
      vector = await getOpenAIEmbedding(text, baseURL, apiKey, model)
    } 
    else if (domain.includes('bigmodel.cn')) {
      console.log('使用智谱 AI API')
      vector = await getZhipuEmbedding(text, baseURL, apiKey, model)
    }
    else {
      console.log('使用通用 API')
      vector = await getGenericEmbedding(text, baseURL, apiKey, model)
    }
    
    // 统一转换为1536维
    const result = resizeVector(vector, 1536)
    console.log('成功生成嵌入向量，原始维度:', vector.length, '转换后维度:', result.length)
    return result
  } catch (error) {
    console.error('生成嵌入向量失败:', error)
    throw error
  }
}

/**
 * 使用OpenAI API生成文本嵌入
 */
async function getOpenAIEmbedding(text: string, baseURL: string, apiKey: string, model: string): Promise<number[]> {
  try {
    console.log('初始化 OpenAI 客户端')
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    })
    
    console.log('调用 OpenAI embeddings API')
    const response = await openai.embeddings.create({
      model: model,
      input: text,
    })
    
    if (!response.data || response.data.length === 0) {
      console.error('OpenAI 返回空结果')
      throw new Error('OpenAI没有返回有效的嵌入结果')
    }
    
    console.log('OpenAI 返回成功，向量维度:', response.data[0].embedding.length)
    return response.data[0].embedding
  } catch (error) {
    console.error('OpenAI嵌入生成失败:', error)
    throw new Error(`OpenAI嵌入生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 使用智谱AI API生成文本嵌入
 */
async function getZhipuEmbedding(text: string, baseURL: string, apiKey: string, model: string): Promise<number[]> {
  try {
    console.log('准备调用智谱 AI API')
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        input: text
      })
    })
    
    if (!response.ok) {
      console.error('智谱 API 请求失败:', response.status, response.statusText)
      const errorData = await response.json() as any
      throw new Error(errorData.error?.message || '智谱API请求失败')
    }
    
    console.log('智谱 API 响应成功，解析响应数据')
    const data = await response.json() as any
    
    if (!data.data || data.data.length === 0 || !data.data[0].embedding) {
      console.error('智谱 AI 返回无效数据:', data)
      throw new Error('智谱AI没有返回有效的嵌入结果')
    }
    
    console.log('智谱 AI 返回成功，向量维度:', data.data[0].embedding.length)
    return data.data[0].embedding
  } catch (error) {
    console.error('智谱AI嵌入生成失败:', error)
    throw new Error(`智谱AI嵌入生成失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 使用通用OpenAI兼容格式的API生成文本嵌入
 */
async function getGenericEmbedding(text: string, baseURL: string, apiKey: string, model: string): Promise<number[]> {
  try {
    console.log('准备调用通用 API')
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        input: text
      })
    })
    
    if (!response.ok) {
      console.error('通用 API 请求失败:', response.status, response.statusText)
      const errorText = await response.text()
      throw new Error(`API请求失败: ${errorText}`)
    }
    
    console.log('通用 API 响应成功，解析响应数据')
    const data = await response.json() as any
    
    if (data.data && data.data.length > 0 && data.data[0].embedding) {
      console.log('通用 API 返回成功，向量维度:', data.data[0].embedding.length)
      return data.data[0].embedding
    } else {
      console.error('通用 API 返回无效数据:', data)
      throw new Error('未找到有效的嵌入结果')
    }
  } catch (error: any) {
    console.error('通用嵌入API调用失败:', error)
    throw new Error(`嵌入生成失败: ${error.message}`)
  }
}

/**
 * 在插入或更新术语时生成并保存嵌入
 * @param term 术语名称
 * @param explanation 术语解释
 * @param english 英文名称（可选）
 * @param config 向量模型配置（必须提供）
 * @returns 嵌入向量
 */
export async function generateGlossaryEmbedding(
  term: string, 
  explanation: string, 
  english?: string,
  config?: VectorModelConfig
): Promise<number[]> {
  console.log('开始生成术语嵌入，术语:', term)
  
  if (!config) {
    console.error('未提供向量模型配置')
    throw new Error('必须提供向量模型配置')
  }
  
  // 组合术语信息以生成更全面的嵌入
  const content = [term, explanation, english].filter(Boolean).join(' ')
  console.log('组合后的文本长度:', content.length)
  
  return await getEmbedding(content, config)
} 