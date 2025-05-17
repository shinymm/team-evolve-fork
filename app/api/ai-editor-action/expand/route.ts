import { NextRequest, NextResponse } from 'next/server';
import { EXPAND_PROMPT } from '@/lib/prompts/expand';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import {
  AIModelConfig,
  isGeminiModel,
  getApiEndpointAndHeaders,
} from '@/lib/services/ai-service';

// 创建一个编码器用于流式响应
const encoder = new TextEncoder();

// 将文本发送为流式响应
async function streamResponse(
  res: ReadableStream, 
  controller: ReadableStreamDefaultController
) {
  const reader = res.getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // 发送数据块
      const chunk = JSON.stringify({ expandedText: new TextDecoder().decode(value) });
      controller.enqueue(encoder.encode(chunk));
    }
  } finally {
    controller.close();
    reader.releaseLock();
  }
}

// 从OpenAI API流式响应处理
async function handleOpenAIStream(
  response: Response,
  controller: ReadableStreamDefaultController
) {
  const reader = response.body?.getReader();
  if (!reader) {
    controller.close();
    return;
  }
  
  const decoder = new TextDecoder();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk
        .split('\n')
        .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const json = JSON.parse(jsonStr);
            
            if (json.choices && json.choices[0]?.delta?.content) {
              // 发送文本块
              const content = json.choices[0].delta.content;
              controller.enqueue(encoder.encode(JSON.stringify({ expandedText: content })));
            }
          } catch (e) {
            console.error('Error parsing JSON from stream:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading stream:', error);
  } finally {
    reader.releaseLock();
    controller.close();
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Invalid input: text is required' }, { status: 400 });
    }

    // 使用 aiModelConfigService 获取默认配置
    const config = await aiModelConfigService.getDefaultConfig();
    if (!config) {
      console.error('Expand API Error: Default AI config not found.');
      return NextResponse.json(
        { error: '未找到默认AI模型配置，请先在设置中配置模型', details: 'Default AI config not found.' },
        { status: 404 }
      );
    }

    // 检查 config 是否包含 model 字段
    if (!config.model) {
      console.error('Expand API Error: Default AI config is missing the required \'model\' field.', config);
      return NextResponse.json(
        { error: '默认AI配置无效', details: 'Default AI config is missing the required \'model\' field.' }, 
        { status: 500 } 
      );
    }

    // 解密 API 密钥
    let decryptedApiKey: string;
    try {
        decryptedApiKey = await decrypt(config.apiKey);
    } catch (decryptionError) {
        console.error('Expand API Error: Failed to decrypt API key.', decryptionError);
        return NextResponse.json(
            { error: '无法使用存储的API密钥', details: 'Failed to decrypt API key.' }, 
            { status: 500 } 
        );
    }

    const finalConfig: AIModelConfig = {
        ...config,
        apiKey: decryptedApiKey,
    };

    const isGemini = isGeminiModel(finalConfig.model);
    const prompt = EXPAND_PROMPT.replace('{text}', text);

    console.log(`Expand request using model: ${finalConfig.model} (Is Gemini: ${isGemini})`);

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 根据模型类型调用相应的 API
          if (isGemini) {
            try {
              const genAI = new GoogleGenerativeAI(finalConfig.apiKey);
              const model = genAI.getGenerativeModel({ 
                model: finalConfig.model,
                generationConfig: {
                  temperature: finalConfig.temperature || 0.7,
                }
              });
              
              const result = await model.generateContentStream(prompt);
              const textStream = result.stream;
              
              // 处理流
              for await (const chunk of textStream) {
                if (chunk.text) {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ expandedText: chunk.text }))
                  );
                }
              }
              
            } catch (geminiError) {
              console.error('Gemini API Error during expand:', geminiError);
              controller.enqueue(
                encoder.encode(JSON.stringify({ 
                  error: `Gemini API request failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}` 
                }))
              );
            }
          } else {
            // 处理标准 OpenAI 兼容 API
            try {
              const { endpoint, headers } = getApiEndpointAndHeaders(finalConfig);
              console.log(`Sending expand stream request to standard endpoint: ${endpoint}`);
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                  model: finalConfig.model,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: finalConfig.temperature || 0.7,
                  stream: true, // 启用流式输出
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Standard API Error during expand (${response.status}): ${errorText}`);
                controller.enqueue(
                  encoder.encode(JSON.stringify({ 
                    error: `API request failed (${response.status}): ${errorText}` 
                  }))
                );
                controller.close();
                return;
              }

              // 处理OpenAI流式响应
              await handleOpenAIStream(response, controller);
            } catch (standardError) {
              console.error('Standard API Error during expand:', standardError);
              controller.enqueue(
                encoder.encode(JSON.stringify({ 
                  error: `Standard API request failed: ${standardError instanceof Error ? standardError.message : String(standardError)}` 
                }))
              );
            }
          }
        } catch (error) {
          console.error('Unhandled error in stream processing:', error);
          controller.enqueue(
            encoder.encode(JSON.stringify({ 
              error: `处理失败: ${error instanceof Error ? error.message : String(error)}` 
            }))
          );
        } finally {
          controller.close();
        }
      }
    });

    // 返回流式响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Error in /api/ai-editor-action/expand:', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails = 'An unexpected error occurred.';
    if (error instanceof Error) {
      errorMessage = 'Failed to expand text';
      errorDetails = error.message;
    }
    if (errorDetails.includes('API key') || errorDetails.includes('credential')) {
      errorDetails = 'AI service authentication or configuration error.';
    }
    return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: 500 });
  }
} 