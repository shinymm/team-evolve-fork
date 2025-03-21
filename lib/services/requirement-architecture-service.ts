import { AIModelConfig } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { streamingAICall } from '@/lib/services/ai-service'

/**
 * 处理从需求文档抽取信息架构树的服务
 */
export class RequirementArchitectureService {
  /**
   * 流式调用API，从需求文档中抽取信息架构树
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   */
  async extractArchitecture(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      const config = await getDefaultAIConfig()
      if (!config) {
        throw new Error('未找到AI配置信息')
      }

      console.log(`[${new Date().toISOString()}] 开始调用extractArchitecture，模型: ${config.model}，文件ID: ${fileIds.join(', ')}`)

      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行信息架构抽取')
      }

      // 构建提示词
      const prompt = `请从以下文件中抽取信息架构树：${fileIds.join(', ')}`

      // 使用统一的streamingAICall方法
      await streamingAICall(
        prompt,
        config,
        onContent,
        (error: string) => {
          throw new Error(`信息架构抽取失败: ${error}`)
        }
      )

      console.log(`[${new Date().toISOString()}] 抽取完成`)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 信息架构抽取失败:`, error)
      throw error
    }
  }
} 