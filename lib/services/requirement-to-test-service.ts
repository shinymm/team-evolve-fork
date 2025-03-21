import { AIModelConfig } from '@/lib/services/ai-service'

/**
 * 处理需求书转测试用例的服务
 */
export class RequirementToTestService {
  /**
   * 流式调用API，将需求文档转换为测试用例
   * @param fileIds 上传的文件ID列表
   * @param config AI模型配置
   * @param onContent 流式返回内容回调
   * @param requirementChapter 需求章节描述（可选）
   */
  async convertToTest(
    fileIds: string[],
    config: AIModelConfig,
    onContent: (content: string) => void,
    requirementChapter?: string
  ): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] 开始调用convertToTest，模型: ${config.model}，文件ID: ${fileIds.join(', ')}`);
      console.log(`需求章节信息: ${requirementChapter || '无'}`);

      // 获取文件内容
      const files = await this.getFilesData(fileIds);
      console.log(`获取到 ${files.length} 个文件的内容`);

      const response = await fetch('/api/convert-to-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          fileIds,
          files, // 传递文件内容
          apiConfig: config,
          requirementChapter
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

      console.log(`[${new Date().toISOString()}] 转换完成`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 生成测试用例失败:`, error);
      throw error;
    }
  }

  /**
   * 获取文件内容
   * @param fileIds 文件ID列表
   * @returns 文件内容数组
   */
  private async getFilesData(fileIds: string[]): Promise<Array<{id: string, name: string, type: string, base64Data: string}>> {
    // 从localStorage获取文件信息
    const filesData = [];
    
    for (const fileId of fileIds) {
      const fileKey = `uploaded_file_${fileId}`;
      const fileDataStr = localStorage.getItem(fileKey);
      
      if (fileDataStr) {
        const fileData = JSON.parse(fileDataStr);
        filesData.push({
          id: fileData.id,
          name: fileData.name,
          type: fileData.type,
          base64Data: fileData.base64Data
        });
      }
    }
    
    return filesData;
  }
} 