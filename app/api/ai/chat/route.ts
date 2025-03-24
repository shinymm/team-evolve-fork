import { NextRequest, NextResponse } from "next/server";
import {
  AIModelConfig,
  getApiEndpointAndHeaders,
  isGeminiModel,
} from "@/lib/services/ai-service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDefaultConfigFromRedis } from "@/lib/utils/ai-config-redis";
import { decrypt } from "@/lib/utils/encryption-utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 从请求中只获取消息和温度参数
    const { messages, model, temperature, apiKey, baseURL } =
      await request.json();

    if (!messages) {
      return NextResponse.json(
        { error: "缺少必要参数：messages" },
        { status: 400 }
      );
    }

    // 尝试从Redis获取默认配置
    const defaultConfig = await getDefaultConfigFromRedis();
    if (!defaultConfig) {
      return NextResponse.json(
        { error: "未找到默认AI模型配置，请先在设置中配置模型" },
        { status: 404 }
      );
    }

    // 解密API密钥
    const decryptedApiKey = await decrypt(defaultConfig.apiKey);

    // 使用默认配置
    const finalConfig: AIModelConfig = {
      ...defaultConfig,
      apiKey: decryptedApiKey,
    };

    console.log("使用默认API配置:", {
      model: finalConfig.model,
      baseURL: finalConfig.baseURL ? "已设置" : "未设置",
      hasApiKey: finalConfig.apiKey ? "已设置" : "未设置",
      temperature: temperature ? temperature : finalConfig.temperature,
    });

    // 统一处理所有模型的请求
    return await handleRequest(messages, finalConfig);
  } catch (error) {
    console.error("API路由处理错误:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

// 统一处理所有模型的请求
/**
 * @param messages 消息数组
 * @param apiConfig Redis中获取的默认模型配置
 */
async function handleRequest(
  messages: any[],
  apiConfig: AIModelConfig
) {
  // 检查是否是Google Gemini模型
  const isGemini = isGeminiModel(apiConfig.model);

  if (isGemini) {
    // 使用Google API处理请求
    return await handleGeminiRequest(messages, apiConfig);
  } else {
    // 使用标准OpenAI兼容API处理请求
    return await handleStandardRequest(messages, apiConfig);
  }
}

// 处理标准OpenAI兼容API请求
/**
 * @param messages 消息数组
 * @param apiConfig Redis中获取的默认模型配置
 * @param temperature 可选的温度参数
 */
async function handleStandardRequest(
  messages: any[],
  apiConfig: AIModelConfig
) {
  try {
    // 获取API端点和请求头
    const { endpoint, headers } = getApiEndpointAndHeaders(apiConfig);

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: apiConfig.model,
        messages
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `API 请求失败 (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("处理标准请求时出错:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}

// 处理Google Gemini API请求
/**
 * @param messages 消息数组
 * @param apiConfig Redis中获取的默认模型配置
 */
async function handleGeminiRequest(
  messages: any[],
  apiConfig: AIModelConfig
) {
  try {
    console.log("Gemini API请求配置:", {
      model: apiConfig.model,
      hasApiKey: !!apiConfig.apiKey,
    });

    // 使用Google的库初始化客户端
    const genAI = new GoogleGenerativeAI(apiConfig.apiKey);
    const model = genAI.getGenerativeModel({ model: apiConfig.model });

    // 转换消息格式以适应Google API
    const geminiContents = messages.map((msg) => ({
      role: msg.role === "system" || msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    console.log("转换后的消息:", JSON.stringify(geminiContents, null, 2));

    // 发送请求
    const result = await model.generateContent({
      contents: geminiContents,
    });

    console.log("Gemini API响应:", result);

    // 从Gemini响应中提取文本内容
    const content = result.response.text();

    return NextResponse.json({ content });
  } catch (error) {
    console.error("处理Gemini请求时出错:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "未知错误" },
      { status: 500 }
    );
  }
}
