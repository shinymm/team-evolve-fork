import { streamingFileAICall } from '@/lib/services/ai-service'
import { requirementToTestPrompt } from '@/lib/prompts/requirement-to-test'

/**
 * 处理需求书转测试用例的服务
 */
export class RequirementToTestService {
  /**
   * 流式调用API，将需求文档转换为测试用例
   * @param fileIds 上传的文件ID列表
   * @param onContent 流式返回内容回调
   * @param requirementChapter 需求章节描述（可选）
   */
  async convertToTest(
    fileIds: string[],
    onContent: (content: string) => void,
    requirementChapter?: string
  ): Promise<void> {
    try {
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行转换')
      }

      // 使用预定义的提示词
      const systemPrompt = '<Role>软件测试专家，根据给定的需求，认真分析，输出完整详细的测试用例</Role>'
      const userPrompt = requirementToTestPrompt(requirementChapter)

      // 使用streamingFileAICall方法
      await streamingFileAICall({
        fileIds,
        systemPrompt,
        userPrompt,
        onContent
      })
    } catch (error) {
      console.error(`生成测试用例失败:`, error)
      throw error
    }
  }
} 