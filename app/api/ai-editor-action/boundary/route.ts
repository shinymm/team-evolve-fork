import { NextRequest } from 'next/server';
import { sceneBoundaryPrompt } from '@/lib/prompts/scene-boundary';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import {
  AIModelConfig,
  isGeminiModel,
  getApiEndpointAndHeaders,
} from '@/lib/services/ai-service';
import { SystemKnowledgeService } from '@/lib/services/system-knowledge';

// 创建一个编码器用于流式响应
const encoder = new TextEncoder();

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
              controller.enqueue(encoder.encode(JSON.stringify({ boundaryAnalysis: content })));
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
    const { text, fullText, systemId } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid input: text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取系统产品知识
    let productKnowledge = {
      productOverview: '',
      userPersonas: '',
      architectureInfo: ''
    };
    
    if (systemId) {
      try {
        productKnowledge = await SystemKnowledgeService.getSystemKnowledge(systemId);
        console.log('成功获取系统产品知识');
      } catch (knowledgeError) {
        console.error('获取系统产品知识失败:', knowledgeError);
        // 失败时继续使用默认空值
      }
    } else {
      console.log('未提供systemId，使用空的产品知识');
    }

    // 使用 aiModelConfigService 获取默认配置
    const config = await aiModelConfigService.getDefaultConfig();
    if (!config) {
      console.error('Boundary API Error: Default AI config not found.');
      return new Response(JSON.stringify(
        { error: '未找到默认AI模型配置，请先在设置中配置模型', details: 'Default AI config not found.' }
      ), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查 config 是否包含 model 字段
    if (!config.model) {
      console.error('Boundary API Error: Default AI config is missing the required \'model\' field.', config);
      return new Response(JSON.stringify(
        { error: '默认AI配置无效', details: 'Default AI config is missing the required \'model\' field.' }
      ), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 解密 API 密钥
    let decryptedApiKey: string;
    try {
        decryptedApiKey = await decrypt(config.apiKey);
    } catch (decryptionError) {
        console.error('Boundary API Error: Failed to decrypt API key.', decryptionError);
        return new Response(JSON.stringify(
            { error: '无法使用存储的API密钥', details: 'Failed to decrypt API key.' }
        ), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const finalConfig: AIModelConfig = {
        ...config,
        apiKey: decryptedApiKey,
    };

    const isGemini = isGeminiModel(finalConfig.model);
    
    // 准备提示词数据
    const promptData = {
      reqBackground: "产品背景"+productKnowledge.productOverview+"； 产品用户画像："+productKnowledge.userPersonas || "无产品背景信息。", 
      reqBrief: fullText, 
      sceneName: "需求场景", 
      sceneContent: text, // 选中的文本作为场景内容
      boundaryRules: "检查需求边界条件，确保功能逻辑完整，规则清晰，异常情况有明确处理方式。" 
    };
    
    // 填充提示词模板
    let prompt = sceneBoundaryPrompt;
    for (const [key, value] of Object.entries(promptData)) {
      prompt = prompt.replace(`{{${key}}}`, value);
    }

    console.log(`Boundary request using model: ${finalConfig.model} (Is Gemini: ${isGemini})`);

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
                    encoder.encode(JSON.stringify({ boundaryAnalysis: chunk.text }))
                  );
                }
              }
              
            } catch (geminiError) {
              console.error('Gemini API Error during boundary analysis:', geminiError);
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
              console.log(`Sending boundary analysis stream request to standard endpoint: ${endpoint}`);
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                  model: finalConfig.model,
                  messages: [
                    { role: 'system', content: '你是一位产品经理的AI助手，擅长分析需求场景的边界条件' },
                    { role: 'user', content: prompt }
                  ],
                  temperature: finalConfig.temperature || 0.7,
                  stream: true, // 启用流式输出
                }),
              });

              if (!response.ok) {
                const errorText = await response.text();
                console.error(`Standard API Error during boundary analysis (${response.status}): ${errorText}`);
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
              console.error('Standard API Error during boundary analysis:', standardError);
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
    console.error('Error in /api/ai-editor-action/boundary:', error);
    let errorMessage = 'Internal Server Error';
    let errorDetails = 'An unexpected error occurred.';
    if (error instanceof Error) {
      errorMessage = 'Failed to analyze boundary conditions';
      errorDetails = error.message;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage, 
      details: errorDetails 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 