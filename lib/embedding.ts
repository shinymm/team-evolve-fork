import { getEmbedding as getServiceEmbedding, getDefaultVectorConfig, VectorModelConfig } from './services/embedding-service'

/**
 * 生成文本的嵌入向量
 * @param text 要生成嵌入的文本
 * @param vectorConfig 可选的向量配置，如果不提供则使用默认配置
 * @returns 嵌入向量
 */
export async function getEmbedding(text: string, vectorConfig?: VectorModelConfig): Promise<number[]> {
  try {
    // 使用传入的配置或从 store 获取默认配置
    const config = vectorConfig || await getDefaultVectorConfig()
    if (!config) {
      throw new Error('未找到可用的向量模型配置')
    }

    // 直接使用embedding-service生成向量
    return await getServiceEmbedding(text, config)
  } catch (error) {
    console.error('生成向量嵌入失败:', error)
    throw error
  }
}

/**
 * 在插入或更新术语时生成并保存嵌入
 * @param term 术语名称
 * @param explanation 术语解释
 * @param english 英文名称（可选）
 * @returns 嵌入向量
 */
export async function generateGlossaryEmbedding(
  term: string, 
  explanation: string, 
  english?: string
): Promise<number[]> {
  // 组合术语信息以生成更全面的嵌入
  const content = [term, explanation, english].filter(Boolean).join(' ')
  return await getEmbedding(content)
} 