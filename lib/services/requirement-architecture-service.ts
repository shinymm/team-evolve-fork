import { requirementArchitecturePrompt } from '@/lib/prompts/requirement-architecture'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

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
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行信息架构抽取')
      }

      console.log('开始信息架构抽取，文件数:', fileIds.length)

      await handleStreamingResponse(
        fileIds,
        '请按照规则和说明，从文档中抽取信息架构树。',
        requirementArchitecturePrompt,
        (content: string) => {
          onContent(content)
        }
      )

      console.log('信息架构抽取完成')
    } catch (error) {
      console.error(`信息架构抽取失败:`, error)
      throw error
    }
  }
} 