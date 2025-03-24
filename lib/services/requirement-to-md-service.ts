import { requirementToMdPrompt } from '@/lib/prompts/requirement-to-md'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 处理需求书转Markdown的服务
 */
export class RequirementToMdService {
  /**
   * 将需求文档转换为Markdown格式
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

      await handleStreamingResponse(
        fileIds,
        '你是一个文档处理的专家，非常了解markdown的语法，善于理解各种文本的内容并整理为标准的markdown格式.',
        requirementToMdPrompt,
        onContent
      )
    } catch (error) {
      console.error(`转换为Markdown失败:`, error)
      throw error
    }
  }
} 