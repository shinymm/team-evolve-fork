import { imageToArchitecturePrompt } from '@/lib/prompts/image-to-architecture'

/**
 * 处理图片提炼信息架构的服务
 */
export class ImageToArchitectureService {
  /**
   * 从图片中提炼信息架构
   * @param fileIds 上传的图片文件ID列表
   * @param onContent 流式返回内容回调
   */
  async extractArchitecture(
    fileIds: string[],
    onContent: (content: string) => void
  ): Promise<void> {
    try {
      if (fileIds.length === 0) {
        throw new Error('请至少选择一个图片文件进行分析')
      }

      // 将文件ID转换为可访问的URL
      const imageUrls = fileIds.map(fileId => {
        // 文件ID是OSS的key，直接包含完整路径
        return `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${fileId}`
      })

      console.log('处理图片文件，转换为URL:', imageUrls);
      
      // 构造FormData
      const formData = new FormData();
      imageUrls.forEach(url => {
        formData.append('imageUrls', url);
      });
      formData.append('prompt', imageToArchitecturePrompt);
      formData.append('systemPrompt', '你是一个产品架构分析专家，善于从界面截图中识别产品模块结构并提炼信息架构。');
      
      // 直接调用API
      const response = await fetch('/api/ai/image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API请求失败 (${response.status}): ${error}`);
      }
      
      if (!response.body) {
        throw new Error('响应中没有body');
      }
      
      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解码并处理数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 处理完整的消息
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            continue;
          }
          
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);
              const data = JSON.parse(jsonStr);
              
              if (data.error) {
                throw new Error(data.error);
              }
              
              if (data.choices?.[0]?.delta?.content) {
                const content = data.choices[0].delta.content;
                accumulatedContent += content;
                onContent(accumulatedContent);
              }
            } catch (e) {
              console.warn('解析消息失败:', e);
            }
          }
        }
      }
      
      // 如果没有累积到任何内容，抛出错误
      if (!accumulatedContent) {
        throw new Error('未收到任何有效内容');
      }
    } catch (error) {
      console.error(`提炼信息架构失败:`, error)
      throw error
    }
  }
} 