import { requirementToSummaryPrompt } from '@/lib/prompts/requirement-to-summary'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 处理需求书转摘要的服务
 */
export class RequirementToSummaryService {
  /**
   * 将需求文档转换为摘要格式
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   */
  async convertToSummary(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行转换')
      }

      await handleStreamingResponse(
        fileIds,
        '你是一个产品规划和业务专家，善于提纲挈领地总结需求目的和要点.',
        requirementToSummaryPrompt,
        onContent
      )
    } catch (error) {
      console.error(`转换为需求摘要失败:`, error)
      throw error
    }
  }
} 