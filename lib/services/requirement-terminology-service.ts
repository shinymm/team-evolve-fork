import { requirementTerminologyPrompt } from '@/lib/prompts/requirement-terminology'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 需求术语抽取服务
 */
export class RequirementTerminologyService {
  /**
   * 抽取文档中的术语知识
   * @param fileIds 文件ID列表
   * @param onContent 内容回调
   */
  async extractTerminology(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (!fileIds || fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行术语抽取')
      }

      // 使用预定义的提示词
      const systemPrompt = '请按照下述规则和说明，从文档中抽取业务术语。'
      
      console.log('开始术语抽取，文件数:', fileIds.length)
      
      await handleStreamingResponse(
        fileIds,
        systemPrompt,
        requirementTerminologyPrompt,
        (content: string) => {
          onContent(content)
        }
      )
      
      console.log('术语抽取完成')
    } catch (error) {
      console.error(`术语抽取失败:`, error)
      throw error
    }
  }
} 