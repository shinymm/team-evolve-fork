import { NextRequest, NextResponse } from "next/server";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";
import { decrypt } from "@/lib/utils/encryption-utils";
import { getApiEndpointAndHeaders, AIModelConfig } from "@/lib/services/ai-service"; // Assuming AIModelConfig is exported, removed isGeminiModel

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Define message structure for OpenAI-compatible models
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// 将数据转换为SSE格式的辅助函数
function formatSSE(data: any) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  try {
    const formData = await request.formData();
    const prompt = formData.get("prompt")?.toString();
    const systemPrompt = formData.get("systemPrompt")?.toString();
    const modelConfigId = formData.get("modelConfigId")?.toString();

    if (!prompt) {
      return NextResponse.json({ error: "请提供提示词 (prompt)" }, { status: 400 });
    }

    console.log("✨ [Reasoning API] 处理推理请求:", {
      promptLength: prompt.length,
      hasSystemPrompt: !!systemPrompt,
      providedModelId: modelConfigId,
    });

    // 1. Get Model Configuration
    let modelConfig: AIModelConfig | null = null;
    if (modelConfigId) {
      modelConfig = await aiModelConfigService.getConfigById(modelConfigId);
      if (!modelConfig) {
        console.log(`⚠️ [Reasoning API] 未找到指定模型配置 (ID: ${modelConfigId})，尝试默认推理模型。`);
      }
    }

    if (!modelConfig) {
      modelConfig = await aiModelConfigService.getDefaultReasoningConfig();
      if (!modelConfig) {
        console.log("⚠️ [Reasoning API] 未找到默认推理模型配置，直接返回错误。");
        return NextResponse.json({ error: "未找到可用的推理模型配置，无法执行慢思考" }, { status: 400 });
      }
    }

    console.log("✨ [Reasoning API] 使用模型配置:", {
      id: modelConfig.id,
      name: modelConfig.name,
      model: modelConfig.model,
      type: modelConfig.type,
      baseURL: modelConfig.baseURL,
    });

    // 2. Prepare for AI Call
    const apiKey = await decrypt(modelConfig.apiKey);
    if (!apiKey) {
        return NextResponse.json({ error: "无法解密API密钥" }, { status: 500 });
    }
    
    const activeModelConfig = { ...modelConfig, apiKey };

    // getApiEndpointAndHeaders will default to OpenAI-compatible structure
    const { endpoint, headers } = getApiEndpointAndHeaders(activeModelConfig);

    // Construct messages for OpenAI-compatible payload
    const messages: OpenAIMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
    
    const requestBody = {
      model: activeModelConfig.model,
      messages: messages,
      stream: true,
      temperature: activeModelConfig.temperature ?? 0.7,
    };

    console.log("✨ [Reasoning API] 发送请求到 (OpenAI-compatible assumed):", endpoint);

    // 3. Make the streaming call
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`🔴 [Reasoning API] AI provider API请求失败 (${aiResponse.status}):`, errorText);
      return NextResponse.json(
        { error: `AI provider请求失败: ${aiResponse.status} ${errorText}` },
        { status: aiResponse.status }
      );
    }

    if (!aiResponse.body) {
      return NextResponse.json({ error: "AI provider响应中没有body" }, { status: 500 });
    }

    // 4. 改用简单的流处理方式，与Next.js兼容性更好
    // 创建一个ReadableStream，使用标准Web API方式
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送初始思考过程状态
          const initialData = formatSSE({
            reasoning_content: "正在思考中...\n",
            content: ""
          });
          controller.enqueue(encoder.encode(initialData));
          
          // 处理上游API的响应
          const reader = (aiResponse.body as ReadableStream<Uint8Array>).getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          // 根据Deepseek Reasoner的响应格式跟踪内容
          let accumulatedReasoning = '正在思考中...\n';
          let accumulatedContent = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // 解码二进制数据并添加到缓冲区
            buffer += decoder.decode(value, { stream: true });
            
            // 记录接收到的原始数据
            console.log('接收到的原始数据:', buffer);
            
            // 按行处理SSE数据
            const lines = buffer.split('\n');
            // 保留最后一行（可能不完整）
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue;
              
              // 处理[DONE]标记
              if (line.includes('[DONE]')) {
                console.log('[Reasoning API] 接收到[DONE]标记，流传输完成');
                continue;
              }
              
              // 处理data:前缀的行
              if (line.startsWith('data:')) {
                const jsonData = line.substring(5).trim();
                console.log('解析data行:', jsonData);
                
                try {
                  // 解析上游API的JSON响应
                  const data = JSON.parse(jsonData);
                  
                  // 专门处理Deepseek Reasoner模型的响应格式
                  if (data.choices && data.choices[0] && data.choices[0].delta) {
                    const delta = data.choices[0].delta;
                    console.log('解析到delta:', JSON.stringify(delta));
                    
                    // 处理推理内容 - 只要有一点更新就立即发送
                    if (delta.reasoning_content) {
                      accumulatedReasoning += delta.reasoning_content;
                      // 发送完整的思考过程内容
                      controller.enqueue(encoder.encode(formatSSE({
                        reasoning_content: accumulatedReasoning
                      })));
                      console.log('[Reasoning API] 发送推理内容更新:', delta.reasoning_content);
                    }
                    
                    // 处理最终内容
                    if (delta.content) {
                      accumulatedContent += delta.content;
                      controller.enqueue(encoder.encode(formatSSE({
                        content: accumulatedContent
                      })));
                      console.log('[Reasoning API] 发送最终内容更新:', delta.content);
                    }
                  } else {
                    // 处理可能的直接格式
                    if (data.reasoning_content) {
                      accumulatedReasoning = data.reasoning_content;
                      controller.enqueue(encoder.encode(formatSSE({
                        reasoning_content: accumulatedReasoning
                      })));
                      console.log('[Reasoning API] 发送直接格式推理内容');
                    }
                    
                    if (data.content) {
                      accumulatedContent = data.content;
                      controller.enqueue(encoder.encode(formatSSE({
                        content: accumulatedContent
                      })));
                      console.log('[Reasoning API] 发送直接格式最终内容');
                    }
                  }
                } catch (e) {
                  console.error("解析SSE数据失败:", e, jsonData);
                }
              }
            }
          }
          
          // 处理可能残留在buffer中的数据
          if (buffer.trim()) {
            try {
              if (buffer.startsWith('data:')) {
                const jsonData = buffer.substring(5).trim();
                if (jsonData && !jsonData.includes('[DONE]')) {
                  const data = JSON.parse(jsonData);
                  if (data.choices && data.choices[0] && data.choices[0].delta) {
                    const delta = data.choices[0].delta;
                    if (delta.reasoning_content) {
                      accumulatedReasoning += delta.reasoning_content;
                      controller.enqueue(encoder.encode(formatSSE({
                        reasoning_content: accumulatedReasoning
                      })));
                    }
                    if (delta.content) {
                      accumulatedContent += delta.content;
                      controller.enqueue(encoder.encode(formatSSE({
                        content: accumulatedContent
                      })));
                    }
                  }
                }
              }
            } catch (e) {
              console.error("处理剩余数据失败:", e);
            }
          }
          
          // 如果到这里还没有最终内容，使用思考过程作为最终内容
          if (!accumulatedContent && accumulatedReasoning) {
            console.log('[Reasoning API] 没有接收到明确的最终内容，使用思考过程作为内容');
            controller.enqueue(encoder.encode(formatSSE({
              content: `${accumulatedReasoning}\n\n总结：思考过程已结束。`
            })));
          }
          
          // 发送完成标记
          controller.enqueue(encoder.encode(formatSSE({ done: true })));
          controller.close();
        } catch (error) {
          console.error("处理流数据失败:", error);
          controller.enqueue(encoder.encode(formatSSE({ error: "处理流数据失败" })));
          controller.close();
        }
      }
    });
    
    // 使用标准Response对象返回流
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("🔴 [Reasoning API] 内部服务器错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "处理推理请求时发生内部错误" },
      { status: 500 }
    );
  }
} 