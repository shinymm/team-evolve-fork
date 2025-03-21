import { AIModelConfig } from '@/lib/services/ai-service'
import { getDefaultAIConfig } from '@/lib/services/ai-config-service'
import { streamingAICall } from '@/lib/services/ai-service'

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
      const config = await getDefaultAIConfig()
      if (!config) {
        throw new Error('未找到AI配置信息')
      }

      console.log(`[${new Date().toISOString()}] 开始调用convertToMd，模型: ${config.model}，文件ID: ${fileIds.join(', ')}`)

      if (fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行转换')
      }

      // 构建提示词
      const prompt = `请将以下文件转换为Markdown格式：${fileIds.join(', ')}`

      // 使用统一的streamingAICall方法
      await streamingAICall(
        prompt,
        config,
        onContent,
        (error: string) => {
          throw new Error(`转换为Markdown失败: ${error}`)
        }
      )

      console.log(`[${new Date().toISOString()}] 转换完成`)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 转换为Markdown失败:`, error)
      throw error
    }
  }
} 