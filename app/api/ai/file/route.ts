import { NextRequest, NextResponse } from "next/server";
import { AIModelConfig, isGeminiModel } from "@/lib/services/ai-service";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { decrypt } from "@/lib/utils/encryption-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 设置最大执行时间为60秒（Vercel hobby计划的最大限制）

// 判断是否是 Qwen API
function isQwenAPI(config: AIModelConfig): boolean {
  return (
    config.baseURL?.includes("dashscope") ||
    config.model?.toLowerCase().includes("qwen")
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileIds = formData.getAll("fileIds") as string[];
    const systemPrompt = formData.get("systemPrompt") as string;
    const userPrompt = formData.get("userPrompt") as string;
    const configJson = formData.get("config") as string | null;

    if (!fileIds.length || !systemPrompt || !userPrompt) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    let config: AIModelConfig;
    
    // 如果请求中没有提供配置，从Redis获取默认配置
    if (!configJson) {
      console.log("请求中未提供配置，尝试从Redis获取默认配置");
      const { getDefaultConfigFromRedis } = await import("@/lib/utils/ai-config-redis");
      const defaultConfig = await getDefaultConfigFromRedis();
      
      if (!defaultConfig) {
        return NextResponse.json(
          { error: "未找到默认配置，请先在设置中配置模型" },
          { status: 404 }
        );
      }
      
      config = defaultConfig;
    } else {
      config = JSON.parse(configJson) as AIModelConfig;
    }

    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(config.model);

    // 根据不同的 API 类型选择不同的处理方法
    if (isGemini) {
      return handleGeminiFileStream(fileIds, systemPrompt, userPrompt, config);
    } else if (isQwenAPI(config)) {
      return handleQwenFileStream(fileIds, systemPrompt, userPrompt, config);
    } else {
      return NextResponse.json(
        { error: "目前只支持 Gemini 或 Qwen API" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("API路由处理错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

// 处理 Gemini 模型的文件流式请求
async function handleGeminiFileStream(
  fileIds: string[],
  systemPrompt: string,
  userPrompt: string,
  config: AIModelConfig
): Promise<Response> {
  try {
    // 解密 API Key
    const decryptedApiKey = await decrypt(config.apiKey);

    // 初始化 Google Generative AI 客户端
    const genAI = new GoogleGenerativeAI(decryptedApiKey);
    const model = genAI.getGenerativeModel({ model: config.model });

    // TODO: 实现 Gemini 的文件处理逻辑
    // 返回一个包含错误信息的流
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              error: "Gemini 文件处理功能正在开发中",
            })}\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    // 返回一个包含错误信息的流
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({
              error: error instanceof Error ? error.message : "未知错误",
            })}\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }
}

// 处理 Qwen API 的文件流式请求
async function handleQwenFileStream(
  fileIds: string[],
  systemPrompt: string,
  userPrompt: string,
  config: AIModelConfig
): Promise<Response> {
  try {
    console.log(`🔥 开始处理Qwen文件流请求，文件ID: ${fileIds.join(',')}`)
    const decryptedKey = await decrypt(config.apiKey)

    // 构造消息数组
    const messages = [
      {
        role: "system",
        content: fileIds.map(id => `fileid://${id}`).join(',')
      },
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ]

    const requestData = {
      model: config.model || "qwen-long",
      messages,
      stream: true
    }

    console.log(`🔥 发送请求到Qwen API: ${config.baseURL}`)

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decryptedKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API请求失败 (${response.status}):`, errorText)
      throw new Error(`API请求失败 (${response.status}): ${errorText}`)
    }

    if (!response.body) {
      console.error('❌ API响应没有body')
      throw new Error('API响应没有body')
    }

    console.log('✅ 成功获取API响应流')

    // 直接返回响应流
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })

  } catch (error) {
    console.error('❌ Qwen API处理错误:', error)
    
    // 返回一个包含错误信息的流
    const stream = new ReadableStream({
      start(controller) {
        const errorMessage = error instanceof Error ? error.message : "未知错误"
        console.error('❌ 返回错误流:', errorMessage)
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: errorMessage })}\n\n`
          )
        )
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }
}
