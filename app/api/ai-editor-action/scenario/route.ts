import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiModelConfigService } from '@/lib/services/ai-model-config-service';
import { decrypt } from '@/lib/utils/encryption-utils';
import {
    AIModelConfig,
    isGeminiModel,
    getApiEndpointAndHeaders,
} from '@/lib/services/ai-service';
// 导入系统知识服务和场景提示模板
import { SystemKnowledgeService } from '@/lib/services/system-knowledge';
import { SCENARIO_RECOGNIZE_PROMPT } from '@/lib/prompts/scenario-recognize';

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
              controller.enqueue(encoder.encode(JSON.stringify({ scenarioAnalysis: content })));
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
        // 从请求中获取文本和系统ID
        const { text, fullText, systemId } = await req.json();
        console.log('场景识别收到请求，文本前10个字符:', text?.substring(0, 10) + '...');

        if (!text || typeof text !== 'string') {
            console.error('场景识别API错误: 无效的输入 - 缺少文本');
            return new Response(JSON.stringify({ error: '无效的输入: 缺少文本' }), {
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

        // 1. 获取默认AI配置
        const config = await aiModelConfigService.getDefaultConfig();
        if (!config) {
            console.error('场景识别API错误: 找不到默认AI配置');
            return new Response(JSON.stringify({ error: '未找到默认AI模型配置', details: '找不到默认AI配置' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (!config.model || !config.apiKey) {
            console.error('场景识别API错误: 默认AI配置缺少模型或API密钥');
            return new Response(JSON.stringify({ error: '默认AI配置无效', details: '默认AI配置缺少模型或API密钥' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. 解密API密钥
        let decryptedApiKey: string;
        try {
            decryptedApiKey = await decrypt(config.apiKey);
        } catch (decryptionError) {
            console.error('场景识别API错误: 无法解密API密钥', decryptionError);
            return new Response(JSON.stringify({ error: '无法使用存储的API密钥', details: '无法解密API密钥' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const finalConfig: AIModelConfig = {
            ...config,
            apiKey: decryptedApiKey,
        };

        // 组装场景识别提示词
        const finalPrompt = SCENARIO_RECOGNIZE_PROMPT
          .replace('{selectedText}', text)
          .replace('{productOverview}', productKnowledge.productOverview)
          .replace('{userPersonas}', productKnowledge.userPersonas)
          .replace('{architectureInfo}', productKnowledge.architectureInfo);

        // 3. 根据配置类型调用相应的AI服务 - 使用流式响应
        const isGemini = isGeminiModel(finalConfig.model);
        console.log(`场景识别请求使用模型: ${finalConfig.model} (是Gemini: ${isGemini})`);
        
        // 创建流式响应
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    if (isGemini) {
                        // 使用Gemini流式API
                        try {
                            const genAI = new GoogleGenerativeAI(finalConfig.apiKey);
                            const model = genAI.getGenerativeModel({ 
                                model: finalConfig.model,
                                generationConfig: {
                                    temperature: finalConfig.temperature || 0.7,
                                }
                            });
                            
                            const result = await model.generateContentStream(finalPrompt);
                            const textStream = result.stream;
                            
                            // 处理流
                            for await (const chunk of textStream) {
                                if (chunk.text) {
                                    controller.enqueue(
                                        encoder.encode(JSON.stringify({ scenarioAnalysis: chunk.text }))
                                    );
                                }
                            }
                        } catch (geminiError) {
                            console.error('Gemini API Error:', geminiError);
                            controller.enqueue(
                                encoder.encode(JSON.stringify({ 
                                    error: `Gemini API request failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}` 
                                }))
                            );
                        }
                    } else {
                        // 处理标准 OpenAI 兼容 API - 流式模式
                        try {
                            const { endpoint, headers } = getApiEndpointAndHeaders(finalConfig);
                            console.log(`发送流式请求到标准终端点: ${endpoint}`);
                            
                            const response = await fetch(endpoint, {
                                method: 'POST',
                                headers: headers,
                                body: JSON.stringify({
                                    model: finalConfig.model,
                                    messages: [{ role: 'user', content: finalPrompt }],
                                    temperature: finalConfig.temperature || 0.7,
                                    stream: true, // 启用流式输出
                                }),
                            });

                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error(`标准API错误 (${response.status}): ${errorText}`);
                                controller.enqueue(
                                    encoder.encode(JSON.stringify({ 
                                        error: `API请求失败 (${response.status}): ${errorText}` 
                                    }))
                                );
                                controller.close();
                                return;
                            }

                            // 处理OpenAI流式响应
                            await handleOpenAIStream(response, controller);
                            
                        } catch (standardError) {
                            console.error('标准API错误:', standardError);
                            controller.enqueue(
                                encoder.encode(JSON.stringify({ 
                                    error: `标准API请求失败: ${standardError instanceof Error ? standardError.message : String(standardError)}` 
                                }))
                            );
                        }
                    }
                } catch (error) {
                    console.error('场景识别API流处理错误:', error);
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
        console.error('场景识别API错误:', error);
        return new Response(JSON.stringify({ 
            error: '执行场景识别失败', 
            details: error instanceof Error ? error.message : '未知错误' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 