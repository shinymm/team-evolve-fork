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
    const configJson = formData.get("config") as string;

    if (!fileIds.length || !systemPrompt || !userPrompt || !configJson) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const config = JSON.parse(configJson) as AIModelConfig;

    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(config.model);

    console.log("文件API配置:", {
      model: config.model,
      isGemini,
      baseURL: config.baseURL ? "已设置" : "未设置",
      apiKey: config.apiKey ? "已设置" : "未设置",
      temperature: config.temperature,
      fileIds,
    });

    // 创建一个新的响应流
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // 根据不同的 API 类型选择不同的处理方法
    if (isGemini) {
      // 处理 Gemini 模型的文件请求
      await handleGeminiFileStream(
        fileIds,
        systemPrompt,
        userPrompt,
        config,
        writer
      );
    } else if (isQwenAPI(config)) {
      // 处理 Qwen API 的文件流式请求
      await handleQwenFileStream(
        fileIds,
        systemPrompt,
        userPrompt,
        config,
        writer
      );
    } else {
      return NextResponse.json(
        { error: "目前只支持 Gemini 或 Qwen API" },
        { status: 400 }
      );
    }

    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store, no-transform, must-revalidate, private, max-age=0",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked",
        "Pragma": "no-cache",
        "Expires": "0"
      },
    });
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
  config: AIModelConfig,
  writer: WritableStreamDefaultWriter
) {
  try {
    console.log("Gemini文件流式请求:", {
      model: config.model,
      apiKey: config.apiKey ? "已设置" : "未设置",
      temperature: config.temperature,
      fileIds,
    });

    // 解密 API Key
    const decryptedApiKey = await decrypt(config.apiKey);

    // 初始化 Google Generative AI 客户端
    const genAI = new GoogleGenerativeAI(decryptedApiKey);
    const model = genAI.getGenerativeModel({ model: config.model });

    // TODO: 实现 Gemini 的文件处理逻辑
    // 目前 Gemini 的文件处理方式与 Qwen 不同，需要进一步研究其 API
    writer.write(
      new TextEncoder().encode(
        `data: ${JSON.stringify({
          error: "Gemini 文件处理功能正在开发中",
        })}\n\n`
      )
    );
    writer.close();
  } catch (error) {
    console.error("请求 Gemini 服务时出错:", error);
    writer.write(
      new TextEncoder().encode(
        `data: ${JSON.stringify({
          error: error instanceof Error ? error.message : "未知错误",
        })}\n\n`
      )
    );
    writer.close();
  }
}

// 处理 Qwen API 的文件流式请求
async function handleQwenFileStream(
  fileIds: string[],
  systemPrompt: string,
  userPrompt: string,
  config: AIModelConfig,
  writer: WritableStreamDefaultWriter
) {
  try {
    console.log(`🔥 开始处理Qwen文件流请求，文件ID: ${fileIds.join(',')}`);
    const decryptedKey = await decrypt(config.apiKey);

    // 构造消息数组
    const messages = [
      {
        role: "system",
        content: `fileid://${fileIds.join(',')}`
      },
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ];

    const requestData = {
      model: config.model || "qwen-long",
      messages,
      stream: true
    };

    console.log(`🔥 发送请求到Qwen API: ${config.baseURL}`);

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${decryptedKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestData)
    });

    console.log(`🔥 收到Qwen API响应: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🔥 Qwen API错误响应:`, errorText);
      writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            error: `API请求失败 (${response.status}): ${errorText}`
          })}\n\n`
        )
      );
      writer.close();
      return;
    }

    if (!response.body) {
      console.error(`🔥 响应中没有body`);
      writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            error: "响应中没有body"
          })}\n\n`
        )
      );
      writer.close();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let counter = 0;
    let totalContent = '';

    console.log(`🔥 开始读取流数据，立即转发`);

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`🔥 流读取完成，共发送 ${counter} 个块，总字符: ${totalContent.length}`);
        break;
      }

      const chunk = decoder.decode(value);
      counter++;
      // console.log(`🔥 收到数据块 #${counter}，长度: ${chunk.length}字符`);

      const lines = chunk
        .split("\n")
        .filter((line) => line.trim() !== "" && line.trim() !== "data: [DONE]");

      for (const line of lines) {
        if (line.includes("data: ")) {
          try {
            const rawData = line.replace("data: ", "");
            const data = JSON.parse(rawData);
            
            // 处理错误
            if (data.error) {
              console.error(`🔥 流数据中有错误:`, data.error);
              writer.write(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({
                    error: data.error
                  })}\n\n`
                )
              );
              continue;
            }
            
            // 处理Qwen的响应 - 直接将内容发送给前端
            if (data.choices && data.choices[0]?.delta?.content) {
              const content = data.choices[0].delta.content;
              totalContent += content;
              
              // 直接发送内容，不添加额外包装
              console.log(`🔥 #${counter} 直接发送内容: ${content.length}字符，总计: ${totalContent.length}字符`);
              
              // 即时发送每个块
              writer.write(
                new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          } catch (e) {
            console.error(`🔥 解析SSE消息错误:`, e);
          }
        }
      }
    }
    
    // 发送完成信号
    writer.write(
      new TextEncoder().encode(
        `data: ${JSON.stringify({
          content: "\n\n[处理完成]",
          done: true
        })}\n\n`
      )
    );
    
    writer.close();
  } catch (error) {
    console.error(`🔥 Qwen流处理错误:`, error);
    try {
      writer.write(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : "未知错误"
          })}\n\n`
        )
      );
    } catch (writeError) {
      console.error(`🔥 写入错误响应失败:`, writeError);
    } finally {
      writer.close();
    }
  }
}
