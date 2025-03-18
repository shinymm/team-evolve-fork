import { useVectorConfigStore } from './stores/vector-config-store'

/**
 * 生成文本的嵌入向量
 * @param text 要生成嵌入的文本
 * @returns 嵌入向量
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // 从 store 获取默认配置
    const config = useVectorConfigStore.getState().getDefaultConfig()
    if (!config) {
      throw new Error('未找到可用的向量模型配置')
    }

    // 调用 API 生成向量嵌入
    const response = await fetch('/api/vector/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        config
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`生成向量嵌入失败: ${error}`)
    }

    const data = await response.json()
    return data.embedding
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