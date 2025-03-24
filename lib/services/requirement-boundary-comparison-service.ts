import { requirementBoundaryComparisonPrompt } from '@/lib/prompts/requirement-boundary-comparison'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 处理需求边界对比的服务
 */
export class RequirementBoundaryComparisonService {
  /**
   * 对比需求文档，抽取边界知识
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   */
  async extractBoundary(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (fileIds.length < 2) {
        throw new Error('请至少选择两个文件进行边界对比')
      }

      if (fileIds.length > 2) {
        throw new Error('边界对比最多支持两个文件')
      }

      console.log('开始边界知识抽取，文件列表:', fileIds)

      await handleStreamingResponse(
        fileIds,
        '请按照规则和说明，从文档中抽取边界知识。',
        requirementBoundaryComparisonPrompt,
        (content: string) => {
          console.log('收到边界知识内容:', content.length, '字符')
          onContent(content)
        }
      )

      console.log('边界知识抽取完成')
    } catch (error) {
      console.error(`边界知识抽取失败:`, error)
      throw error
    }
  }
} 