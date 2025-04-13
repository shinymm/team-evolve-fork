import { productValuePositioningPrompt } from '@/lib/prompts/product-value-positioning'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 产品价值定位分析服务
 */
export class ProductValuePositioningService {
  /**
   * 从需求文档中分析产品价值定位
   * @param fileIds 文件ID列表
   * @param onContent 内容回调
   */
  async analyzeProductValuePositioning(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (!fileIds || fileIds.length === 0) {
        throw new Error('请至少选择一个文件进行产品价值定位分析')
      }

      // 使用预定义的提示词
      const systemPrompt = '请按照下述规则和说明，从需求文档中分析产品价值定位。'
      
      console.log('开始产品价值定位分析，文件数:', fileIds.length)
      
      await handleStreamingResponse(
        fileIds,
        systemPrompt,
        productValuePositioningPrompt,
        (content: string) => {
          onContent(content)
        }
      )
      
      console.log('产品价值定位分析完成')
    } catch (error) {
      console.error(`产品价值定位分析失败:`, error)
      throw error
    }
  }
} 