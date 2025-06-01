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

export async function POST(request: NextRequest): Promise<NextResponse> {
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
        console.log("⚠️ [Reasoning API] 未找到默认推理模型配置，尝试默认语言模型。");
        modelConfig = await aiModelConfigService.getDefaultConfig(); // Fallback to default language model
      }
    }

    if (!modelConfig) {
      return NextResponse.json({ error: "未找到可用的AI模型配置" }, { status: 500 });
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

    // 4. Stream the response back to the client
    const stream = aiResponse.body;
    
    return new NextResponse(stream, {
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