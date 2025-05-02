/**
 * 视觉处理服务
 * 支持VL和QVQ两种模型
 */

/**
 * 视觉处理服务
 */
export class VisionService {
  /**
   * 处理图像分析请求
   * @param imageUrls 图片URL列表
   * @param prompt 提示词
   * @param onReasoning 接收推理过程的回调
   * @param onAnswer 接收答案内容的回调
   */
  async analyzeImage(
    imageUrls: string[],
    prompt: string,
    onReasoning: (content: string) => void,
    onAnswer: (content: string) => void,
    systemPrompt?: string
  ): Promise<void> {
    try {
      if (imageUrls.length === 0) {
        throw new Error('请至少选择一个图片进行分析');
      }

      console.log('处理图片，图片URL数量:', imageUrls.length);
      
      // 构造FormData
      const formData = new FormData();
      imageUrls.forEach(url => {
        formData.append('imageUrls', url);
      });
      formData.append('prompt', prompt);
      if (systemPrompt) {
        formData.append('systemPrompt', systemPrompt);
      }
      
      // 调用视觉API
      const response = await fetch('/api/ai/vision', {
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
      let accumulatedReasoningContent = '';
      let accumulatedAnswerContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        // 解码并处理数据
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 处理完整的消息
        const lines = buffer.split('\n\n');
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
              
              // 处理推理型模型的推理内容
              if (data.type === 'reasoning' && data.content) {
                accumulatedReasoningContent += data.content;
                onReasoning(accumulatedReasoningContent);
                continue;
              }
              
              // 处理推理型模型的答案内容
              if (data.type === 'answer' && data.content) {
                accumulatedAnswerContent += data.content;
                onAnswer(accumulatedAnswerContent);
                continue;
              }
              
              // 处理普通VL模型的内容
              if (data.choices?.[0]?.delta?.content) {
                const content = data.choices[0].delta.content;
                accumulatedAnswerContent += content;
                onAnswer(accumulatedAnswerContent);
              }
            } catch (e) {
              console.warn('解析消息失败:', e);
            }
          }
        }
      }
      
      // 如果没有累积到任何内容，抛出错误
      if (!accumulatedAnswerContent && !accumulatedReasoningContent) {
        throw new Error('未收到任何有效内容');
      }
    } catch (error) {
      console.error(`图像分析失败:`, error);
      throw error;
    }
  }
} 