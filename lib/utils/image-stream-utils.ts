/**
 * 图像流处理工具函数
 */

/**
 * 处理图像流式响应
 * @param imageUrls 图片URL列表
 * @param prompt 提示词
 * @param onContent 内容回调函数
 * @param systemPrompt 可选的系统提示词
 */
export async function handleImageStreamingResponse(
  imageUrls: string[],
  prompt: string,
  onContent: (content: string) => void,
  systemPrompt?: string
): Promise<void> {
  try {
    console.log('开始处理图像流式响应，图片数:', imageUrls.length);
    
    // 构造FormData
    const formData = new FormData();
    imageUrls.forEach(url => {
      formData.append('imageUrls', url);
    });
    formData.append('prompt', prompt);
    
    if (systemPrompt) {
      formData.append('systemPrompt', systemPrompt);
    }

    // 发送请求到专门的图像处理API
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

    // 读取响应流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('图像分析流读取完成，累计内容长度:', accumulatedContent.length);
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
        if (!trimmedLine) {
          continue;
        }
        if (trimmedLine === 'data: [DONE]') {
          console.log('收到结束标记');
          continue;
        }
        
        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6);
            const data = JSON.parse(jsonStr);
            
            if (data.error) {
              console.error('收到错误消息:', data.error);
              throw new Error(data.error);
            }
            
            // 解析不同格式的消息
            if (data.choices?.[0]?.delta?.content) {
              // OpenAI兼容格式
              const content = data.choices[0].delta.content;
              accumulatedContent += content;
              onContent(accumulatedContent);
            } else if (data.output?.choices?.[0]?.message?.content?.[0]?.text) {
              // 通义千问VL格式
              const content = data.output.choices[0].message.content[0].text;
              accumulatedContent += content;
              onContent(accumulatedContent);
            } else if (data.content) {
              // 简单内容格式
              accumulatedContent = data.content;
              onContent(data.content);
            } else {
              console.warn('无法识别的消息格式:', JSON.stringify(data));
            }
          } catch (e) {
            console.warn('解析消息失败:', e instanceof Error ? e.message : '未知错误', '原始消息:', trimmedLine);
            continue;
          }
        } else {
          console.log('未知格式的行:', trimmedLine);
        }
      }
    }

    // 如果没有累积到任何内容，抛出错误
    if (!accumulatedContent) {
      throw new Error('未收到任何有效内容');
    }

  } catch (error) {
    console.error('图像流处理错误:', error);
    throw error;
  }
} 