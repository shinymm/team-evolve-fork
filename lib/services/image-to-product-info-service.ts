import { imageToProductInfoPrompt } from '@/lib/prompts/image-to-product-info'
import { handleStreamingResponse } from '@/lib/utils/stream-utils'

/**
 * 处理图片提炼产品基础信息的服务
 */
export class ImageToProductInfoService {
  /**
   * 从图片中提炼产品基础信息
   * @param fileIds 上传的图片文件ID列表
   * @param onContent 流式返回内容回调
   */
  async extractProductInfo(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个图片文件进行分析')
      }

      await handleStreamingResponse(
        fileIds,
        '你是一个产品分析专家，善于从界面截图中识别产品特征并提炼核心信息。',
        imageToProductInfoPrompt,
        onContent
      )
    } catch (error) {
      console.error(`提炼产品基础信息失败:`, error)
      throw error
    }
  }
} 