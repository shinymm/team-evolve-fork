import { streamingAICall, AIModelConfig } from '@/lib/ai-service'
import { requirementToMdPrompt } from '@/lib/prompts/requirement-to-md'

/**
 * 处理需求书转MD的服务
 */
export class RequirementToMdService {
  /**
   * 流式调用API，将需求文档转换为MD格式
   * @param fileIds 上传的文件ID列表
   * @param config AI模型配置
   * @param onContent 流式返回内容回调
   */
  async convertToMd(
    fileIds: string[],
    config: AIModelConfig,
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      console.log(`正在调用转换API，使用模型: ${config.model}，文件ID: ${fileIds.join(', ')}`);

      // 调用API端点
      const response = await fetch('/api/convert-to-md', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds,
          apiConfig: config
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorText = errorData?.error || response.statusText
        throw new Error(`API请求失败: ${response.status} ${errorText}`)
      }

      // 处理流式响应
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          onContent(chunk);
        }
      }
    } catch (error) {
      console.error('转换需求书到MD失败:', error)
      throw error
    }
  }
} 