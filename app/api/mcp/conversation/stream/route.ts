import { NextResponse } from "next/server";
import { mcpClientService } from "@/server/services/mcp-client.service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders } from "@/lib/services/ai-service";
import { AIModelConfig } from "@/lib/services/ai-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";
import { getRedisClient } from '@/lib/redis';
import { QueuedToolCall } from '@/types/mcp';
import { getCurrentUser } from '@/lib/utils/auth-utils';

// 流式响应编码器
const encoder = new TextEncoder();

interface ConversationRequest {
  sessionId?: string;
  userMessage: string;
  memberInfo?: {
    name: string;
    role: string;
    responsibilities: string;
    mcpConfigJson?: string;
  };
  connectionParams?: any;
  previousToolState?: {
    name: string;
    state: any;
  }
  modelConfig?: {
    model: string;
    baseURL: string;
    apiKey: string;
    temperature: number;
  }
}

interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

const redis = getRedisClient();

/**
 * 处理流式对话请求
 */
export async function POST(req: Request) {
  // 获取当前用户信息
  const user = await getCurrentUser();
  if (!user) {
    console.error("[API Stream] Unauthorized: No authenticated user found.");
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      // 辅助函数：发送错误事件
      function sendErrorEvent(controller: ReadableStreamDefaultController, message: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'error', 
          content: message 
        })}\n\n`));
      }

      // 辅助函数：发送状态事件
      function sendStatusEvent(controller: ReadableStreamDefaultController, message: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'status', 
          content: message 
        })}\n\n`));
      }

      // 辅助函数：发送内容更新事件
      function sendContentEvent(controller: ReadableStreamDefaultController, content: string) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          type: 'content', 
          content 
        })}\n\n`));
      }

      try {
        // 解析请求参数
        const { userMessage, memberInfo, modelConfig } = await req.json() as ConversationRequest;
        
        // 验证必要参数
        if (!userMessage) {
          sendErrorEvent(controller, '缺少必要参数: userMessage');
          controller.close();
          return;
        }

        console.log('请求参数:', {
          hasMemberInfo: !!memberInfo,
          modelConfig: modelConfig ? {
            model: modelConfig.model,
            hasBaseURL: !!modelConfig.baseURL,
            hasApiKey: !!modelConfig.apiKey
          } : '无'
        });

        // 解析模型配置
        let apiConfig: any = null;
        let decryptedApiKeyForLLM: string | null = null;

        if (modelConfig && modelConfig.model && modelConfig.baseURL && modelConfig.apiKey) {
          try {
            decryptedApiKeyForLLM = await decrypt(modelConfig.apiKey);
            apiConfig = {
              model: modelConfig.model,
              baseURL: modelConfig.baseURL,
              apiKey: decryptedApiKeyForLLM,
              temperature: modelConfig.temperature || 0.2
            };
            console.log('[流式对话] 成功解密和配置自定义模型 API Key');
          } catch (error) {
            console.error('[流式对话] 解密自定义API Key失败:', error);
            sendErrorEvent(controller, '无法解密自定义API Key');
            controller.close();
            return;
          }
        } else {
          try {
            // 尝试使用默认配置
            const defaultConfig = await aiModelConfigService.getDefaultConfig();
            if (!defaultConfig) {
              sendErrorEvent(controller, '缺少有效的模型配置，且系统未配置默认模型');
              controller.close();
              return;
            }
            
            decryptedApiKeyForLLM = await decrypt(defaultConfig.apiKey);
            apiConfig = {
              model: defaultConfig.model,
              baseURL: defaultConfig.baseURL,
              apiKey: decryptedApiKeyForLLM,
              temperature: defaultConfig.temperature || 0.7
            };
            console.log('[流式对话] 使用系统默认模型配置');
          } catch (error) {
            console.error('[流式对话] 获取和解密默认API Key失败:', error);
            sendErrorEvent(controller, '缺少有效的模型配置，且无法使用系统默认配置');
            controller.close();
            return;
          }
        }

        // 准备系统提示词和消息
        const systemPrompt = memberInfo ? 
          `你是一个名为${memberInfo.name}的AI团队成员。${memberInfo.role}。你的职责是${memberInfo.responsibilities}。请提供专业、有价值的回复。` : 
          "你是一个专业的AI助手。回答用户问题时简洁清晰，提供有价值的信息。";

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ];

        // 获取API终端和头信息
        const { endpoint, headers } = getApiEndpointAndHeaders({
          ...apiConfig,
          id: 'custom',
          name: apiConfig.model
        } as AIModelConfig);

        try {
          // 发送请求
          console.log(`[流式对话] 准备调用 LLM API: ${endpoint}`);
          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: apiConfig.model,
              messages,
              temperature: apiConfig.temperature,
              max_tokens: 1000,
              stream: true
            }),
          });

          console.log(`[流式对话] API响应状态: ${response.status}`);
          if (!response.ok) {
            const errorText = await response.text();
            sendErrorEvent(controller, `LLM API请求失败 (${response.status}): ${errorText}`);
            controller.close();
            return;
          }

          // 处理流式响应
          const reader = response.body?.getReader();
          if (!reader) {
            sendErrorEvent(controller, '无法读取响应流');
            controller.close();
            return;
          }

          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('[流式对话] 流式传输完成');
              break;
            }
            
            const chunk = new TextDecoder().decode(value);
            buffer += chunk;
            
            let dataPrefixIndex = buffer.indexOf('data: ');
            while (dataPrefixIndex !== -1) {
              const nextDataPrefixIndex = buffer.indexOf('data: ', dataPrefixIndex + 6);
              const endOfData = (nextDataPrefixIndex === -1) ? buffer.length : nextDataPrefixIndex;
              const lineContent = buffer.substring(dataPrefixIndex + 6, endOfData).trim();
              
              if (lineContent && lineContent !== '[DONE]') {
                try {
                  const data = JSON.parse(lineContent);
                  if (data.choices && data.choices[0]?.delta?.content) {
                    sendContentEvent(controller, data.choices[0].delta.content);
                  }
                } catch (error) {
                  console.error('解析流数据出错:', error);
                }
              }
              
              buffer = buffer.substring(endOfData);
              dataPrefixIndex = buffer.indexOf('data: ');
            }
          }
        } catch (error) {
          console.error('调用API出错:', error);
          sendErrorEvent(controller, error instanceof Error ? error.message : '调用API时发生未知错误');
        }
      } catch (error) {
        console.error('处理请求出错:', error);
        sendErrorEvent(controller, error instanceof Error ? error.message : '处理请求时发生未知错误');
      } finally {
        controller.close();
      }
    }
  });

  // 返回流式响应
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
} 