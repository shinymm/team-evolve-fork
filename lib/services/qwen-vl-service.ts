/**
 * 阿里云通义千问VL视觉模型服务
 * 参考文档: https://help.aliyun.com/zh/model-studio/vision
 */
import 'server-only';
import { AIModelConfig } from './ai-service';
import { decrypt } from '@/lib/utils/encryption-utils';

// VL模型类型
export type QwenVLModelType = 'qwen-vl-plus' | 'qwen-vl-max' | 'qwen-vl-max-latest' | 'qwen2.5-vl' | string;

// 消息类型
export interface QwenVLMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type?: string;
    text?: string;
    image?: string;
    image_url?: {
      url: string;
    };
  }>;
}

/**
 * 通义千问VL模型API服务
 */
export class QwenVLService {
  /**
   * 优化图片URL，提高访问成功率
   * @param url 原始图片URL
   * @returns 优化后的URL
   */
  private optimizeImageUrl(url: string): string {
    // 检测是否为阿里云OSS URL
    if (url.includes('aliyuncs.com')) {
      try {
        // 尝试添加处理参数以减小图片大小
        // 宽度限制为1024，格式转为jpg，质量80%
        if (!url.includes('?')) {
          return `${url}?x-oss-process=image/resize,w_1024/format,jpg/quality,q_80`;
        } else if (!url.includes('x-oss-process=image')) {
          return `${url}&x-oss-process=image/resize,w_1024/format,jpg/quality,q_80`;
        }
      } catch (e) {
        console.warn('优化图片URL出错:', e);
      }
    }
    return url;
  }

  /**
   * 处理图像分析请求
   * @param imageUrls 图像URL数组
   * @param prompt 提示词
   * @param modelConfig 模型配置
   * @param systemPrompt 系统提示词(可选)
   * @returns 图像分析的流式响应
   */
  async analyzeImages(
    imageUrls: string[],
    prompt: string,
    modelConfig: AIModelConfig,
    systemPrompt?: string
  ): Promise<Response> {
    try {
      console.log('[QwenVLService] - Service invoked.');
      
      // 解密API密钥
      console.log('[QwenVLService] - Decrypting API key...');
      const apiKey = await decrypt(modelConfig.apiKey);
      console.log('[QwenVLService] - API key decrypted.');
      
      // 使用OpenAI兼容模式的API地址
      const baseURL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      
      // 图片预处理 - 优化和验证图片URL
      console.log('[QwenVLService] - Optimizing image URLs...');
      const optimizedUrls = imageUrls.map(url => this.optimizeImageUrl(url));
      console.log('[QwenVLService] - Image URLs optimized.');
      
      // 图片预处理 - 验证图片是否可访问
      const validatedImageUrls: string[] = [];
      console.log('[QwenVLService] - Validating image accessibility...');
      
      for (const url of optimizedUrls) {
        try {
          console.log(`[QwenVLService] - Validating URL: ${url.substring(0, 70)}...`);
          // 修复：使用AbortController实现超时，而不是非标准的timeout选项
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时
          
          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log(`[QwenVLService] - Validation fetch completed for URL: ${url.substring(0, 70)}`);
          
          if (response.ok) {
            validatedImageUrls.push(url);
            console.log(`✅ 图片验证成功: ${url.substring(0, 50)}...`);
          } else {
            console.warn(`⚠️ 图片验证失败: ${url.substring(0, 50)}...`, response.status);
          }
        } catch (error) {
          console.warn(`⚠️ 图片验证出错: ${url.substring(0, 50)}...`, error);
        }
      }
      
      if (validatedImageUrls.length === 0) {
        console.error('[QwenVLService] - CRITICAL: All image URLs failed validation.');
        throw new Error('所有图片URL验证失败，无法进行分析');
      }
      
      console.log(`[QwenVLService] - Image validation complete. Valid URLs: ${validatedImageUrls.length}/${imageUrls.length}`);
      
      // 构建消息数组
      console.log('[QwenVLService] - Building message array...');
      const messages: QwenVLMessage[] = [];
      
      // 添加可选的系统消息
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: [{
            type: "text",
            text: systemPrompt
          }]
        });
      }
      
      // 构建用户消息 - 包含图片和文本
      const userContent: { type?: string; text?: string; image?: string; image_url?: { url: string } }[] = [];
      
      // 添加所有验证通过的图片，使用正确的图片URL格式
      validatedImageUrls.forEach(url => {
        userContent.push({ 
          type: "image_url",
          image_url: {
            url: url
          }
        });
      });
      
      // 添加文本提示
      userContent.push({ 
        type: "text",
        text: prompt 
      });
      
      // 添加到消息数组
      messages.push({
        role: 'user',
        content: userContent
      });
      console.log('[QwenVLService] - Message array built.');
      
      // 构建请求体
      const requestBody = {
        model: modelConfig.model || 'qwen-vl-max-latest',
        messages: messages,
        stream: true,
      };
      
      console.log('[QwenVLService] - Request body constructed. Preparing to fetch from LLM API.');
      
      // 添加重试逻辑
      let retryCount = 0;
      const maxRetries = 2;
      let lastError = null;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`[QwenVLService] - Attempt #${retryCount + 1} to fetch from LLM API...`);
          // 发送请求
          const response = await fetch(baseURL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          console.log(`[QwenVLService] - Attempt #${retryCount + 1} response received from LLM API.`);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', errorText);
            
            // 如果是图片下载超时错误，可能需要减少图片数量重试
            if (errorText.includes('Download the media resource timed out') && retryCount < maxRetries) {
              // 如果有多张图片，每次重试减少一张
              if (validatedImageUrls.length > 1) {
                validatedImageUrls.pop(); // 移除最后一张图片
                
                // 重建用户消息内容
                const updatedUserContent: any[] = [];
                validatedImageUrls.forEach(url => {
                  updatedUserContent.push({ 
                    type: "image_url",
                    image_url: { url }
                  });
                });
                
                // 添加文本提示
                updatedUserContent.push({ type: "text", text: prompt });
                
                // 更新消息
                messages[messages.length - 1].content = updatedUserContent;
                requestBody.messages = messages;
                
                console.log(`⚠️ 图片下载超时，减少图片数量后重试: ${validatedImageUrls.length}张`);
                retryCount++;
                continue;
              }
            }
            
            throw new Error(`通义千问VL API请求失败: ${response.status} ${errorText}`);
          }
          
          // 转换阿里云的流式响应为OpenAI兼容的SSE格式
          const transformStream = new TransformStream({
            async transform(chunk, controller) {
              try {
                const text = new TextDecoder().decode(chunk);
                const lines = text.split('\n');
                
                for (const line of lines) {
                  if (!line.trim()) continue;
                  
                  if (line.trim() === 'data: [DONE]') {
                    controller.enqueue(new TextEncoder().encode(line + '\n\n'));
                    continue;
                  }
                  
                  try {
                    // 兼容模式下，响应格式已经是OpenAI格式，可以直接传递
                    if (line.startsWith('data: ')) {
                      controller.enqueue(new TextEncoder().encode(line + '\n\n'));
                    }
                  } catch (e) {
                    console.warn('解析响应失败:', e, line);
                  }
                }
              } catch (error) {
                console.error('转换流错误:', error);
                const errorMessage = error instanceof Error ? error.message : '未知错误';
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
              }
            },
            flush(controller) {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            }
          });
          
          // 返回转换后的流
          return new Response(response.body?.pipeThrough(transformStream), {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            }
          });
        } catch (error) {
          console.error(`重试 #${retryCount+1} 失败:`, error);
          lastError = error;
          retryCount++;
          
          // 短暂延迟后重试
          if (retryCount <= maxRetries) {
            console.log(`等待${retryCount}秒后进行第 ${retryCount} 次重试...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
          }
        }
      }
      
      // 如果所有重试都失败，返回一个包含错误信息的流式响应
      if (lastError) {
        console.error('所有重试均失败，将返回错误信息流。最后一个错误:', lastError);
        const errorMessage = lastError instanceof Error ? lastError.message : '所有重试均失败';
        const errorStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        return new Response(errorStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      } else {
        throw new Error('所有重试失败，但未捕获具体错误');
      }
    } catch (error) {
      console.error('[QwenVLService] - CRITICAL ERROR in analyzeImages:', error);
      
      // 创建错误响应流
      const stream = new ReadableStream({
        start(controller) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }
  }
} 