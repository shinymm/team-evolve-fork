import { AIModelConfig } from '@/lib/services/ai-service'

/**
 * 处理需求对比抽取边界知识的服务
 */
export class RequirementBoundaryComparisonService {
  /**
   * 流式调用API，对比需求文档初稿和终稿，提取边界条件知识
   * @param fileIds 上传的文件ID列表（需要包含两个文件ID，初稿和终稿）
   * @param config AI模型配置
   * @param onContent 流式返回内容回调
   */
  async compareRequirements(
    fileIds: string[],
    config: AIModelConfig,
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] 开始调用compareRequirements，模型: ${config.model}，文件ID: ${fileIds.join(', ')}`);

      if (fileIds.length !== 2) {
        throw new Error('请选择两个文件进行对比（初稿和终稿）');
      }

      const response = await fetch('/api/compare-requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          fileIds,
          apiConfig: config
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('API错误响应:', error);
        throw new Error(`API请求失败 (${response.status}): ${error}`);
      }

      if (!response.body) {
        throw new Error('响应中没有body');
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let chunkCounter = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log(`[${new Date().toISOString()}] 流读取完成，共处理${chunkCounter}个数据块`);
            break;
          }
          
          chunkCounter++;
          const chunk = decoder.decode(value, { stream: true });
          console.log(`[${new Date().toISOString()}] 收到数据块#${chunkCounter}，长度: ${chunk.length}字节`);
          
          if (chunk && chunk.length > 0) {
            // 确保回调被调用，即使内容块很小
            onContent(chunk);
          }
        }
      } catch (readError) {
        console.error(`[${new Date().toISOString()}] 流读取错误:`, readError);
        throw readError;
      }

      console.log(`[${new Date().toISOString()}] 对比分析完成`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 需求对比失败:`, error);
      throw error;
    }
  }
} 