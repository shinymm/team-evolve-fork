import { streamingFileAICall } from '@/lib/services/ai-service'
import { requirementToMdPrompt } from '@/lib/prompts/requirement-to-md'

/**
 * 处理需求书转Markdown的服务
 */
export class RequirementToMdService {
  /**
   * 流式调用API，将需求文档转换为Markdown格式
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   */
  async convertToMd(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行转换')
      }

      // 使用预定义的提示词
      const systemPrompt = 'You are a helpful assistant that converts requirement documents to Markdown format.'
      const userPrompt = requirementToMdPrompt

      // 使用streamingFileAICall方法
      await streamingFileAICall({
        fileIds,
        systemPrompt,
        userPrompt,
        onContent
      })
    } catch (error) {
      console.error(`转换为Markdown失败:`, error)
      throw error
    }
  }
} 