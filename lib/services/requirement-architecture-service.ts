import { AIModelConfig, streamingFileAICall } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { requirementArchitecturePrompt } from '@/lib/prompts/requirement-architecture'

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

      // 使用预定义的提示词
      const systemPrompt = requirementArchitecturePrompt
      const userPrompt = '请按照上述规则和说明，从文档中抽取信息架构树。'

      // 使用streamingFileAICall方法
      await streamingFileAICall({
        fileIds,
        systemPrompt,
        userPrompt,
        onContent,
        apiConfig: config
      })

      console.log(`[${new Date().toISOString()}] 抽取完成`)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 信息架构抽取失败:`, error)
      throw error
    }
  }
} 