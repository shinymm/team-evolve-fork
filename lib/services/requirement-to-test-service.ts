import { requirementToTestPrompt } from '@/lib/prompts/requirement-to-test'

/**
 * 处理需求书转测试用例的服务
 */
export class RequirementToTestService {
  /**
   * 将需求文档转换为测试用例
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

      // 构造FormData
      const formData = new FormData()
      fileIds.forEach(fileId => {
        formData.append('fileIds', fileId)
      })
      formData.append('systemPrompt', '<Role>软件测试专家，根据给定的需求，认真分析，输出完整详细的测试用例</Role>')
      formData.append('userPrompt', requirementToTestPrompt(requirementChapter))

      // 直接调用API端点
      const response = await fetch('/api/ai/file', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API请求失败 (${response.status}): ${error}`)
      }

      if (!response.body) {
        throw new Error('响应中没有body')
      }

      // 处理流式响应
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]')

        for (const line of lines) {
          if (line.includes('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''))
              
              if (data.error) {
                throw new Error(data.error)
              }
              
              if (data.content) {
                onContent(data.content)
              }
            } catch (e) {
              console.error('解析响应数据失败:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error(`生成测试用例失败:`, error)
      throw error
    }
  }
} 