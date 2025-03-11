import { NextRequest, NextResponse } from 'next/server'
import { requirementToMdPrompt } from '@/lib/prompts/requirement-to-md'
import OpenAI from 'openai'
import { isGeminiModel } from '@/lib/ai-service'
import { GoogleGenerativeAI, Part } from '@google/generative-ai'
import { GoogleAIFileManager } from '@google/generative-ai/server'

// 文件类型定义
interface FileInfo {
  id: string;
  [key: string]: any;
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log(`[${new Date().toISOString()}] API: 收到需求转MD请求`);
    const { fileIds, files, apiConfig } = await request.json()
    
    console.log(`[${new Date().toISOString()}] API: 原始请求参数:`, JSON.stringify({
      fileIds: fileIds,
      files: files,
      apiConfig: {
        ...apiConfig,
        apiKey: '***' // 隐藏API密钥
      }
    }, null, 2));
    
    // 检查并规范化fileIds
    let normalizedFileIds = Array.isArray(fileIds) ? fileIds : [];
    if (files && files.length > 0) {
      console.log(`[${new Date().toISOString()}] API: 检测到files数组，长度=${files.length}`);
      // 如果提供了files，将其ID添加到fileIds中
      const fileIdsFromFiles = files.map((f: FileInfo) => {
        console.log(`[${new Date().toISOString()}] API: 处理file对象:`, JSON.stringify(f, null, 2));
        // 检查file对象的完整性
        if (!f || !f.id) {
          console.error(`[${new Date().toISOString()}] API: 无效的file对象:`, f);
          return null;
        }
        if (f.provider === 'gemini' && f.uri) {
          console.log(`[${new Date().toISOString()}] API: 检测到Gemini文件，ID=${f.id}, URI=${f.uri}`);
        }
        return f.id;
      }).filter(Boolean);
      console.log(`[${new Date().toISOString()}] API: 从files提取的IDs:`, fileIdsFromFiles);
      normalizedFileIds = [...normalizedFileIds, ...fileIdsFromFiles];
    }
    
    if (!normalizedFileIds.length) {
      return NextResponse.json(
        { error: '请提供有效的文件ID或文件内容' },
        { status: 400 }
      )
    }
    
    console.log(`[${new Date().toISOString()}] API: 规范化后的文件IDs:`, normalizedFileIds);
    
    if (!apiConfig) {
      return NextResponse.json(
        { error: '请提供API配置' },
        { status: 400 }
      )
    }
    
    const { model, apiKey, baseURL } = apiConfig
    
    if (!model || !apiKey) {
      return NextResponse.json(
        { error: 'API配置不完整' },
        { status: 400 }
      )
    }
    
    // 检查是否是Google Gemini模型
    const isGemini = isGeminiModel(model)
    
    // 执行流式响应
    const encoder = new TextEncoder();
    const responseStream = new TransformStream()
    const writer = responseStream.writable.getWriter()
    
    // 异步处理流
    const streamResponse = async () => {
      try {
        // 准备消息内容
        console.log(`[${new Date().toISOString()}] API: 处理请求，模型=${model}, 文件数=${normalizedFileIds.length}, 是否Gemini=${isGemini}`);
        
        if (isGemini) {
          // 处理Gemini模型的文件请求
          await handleGeminiFileRequest(normalizedFileIds, model, apiKey, writer);
        } else {
          // 处理OpenAI兼容API的文件请求
          await handleOpenAIFileRequest(normalizedFileIds, model, apiKey, baseURL, writer);
        }
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] API: 流处理错误:`, error);
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        await writer.write(encoder.encode(`\n\n错误: ${errorMessage}`));
        await writer.close();
      }
    }
    
    // 开始异步处理
    streamResponse();
    
    console.log(`[${new Date().toISOString()}] API: 返回流式响应`);
    
    // 返回流式响应
    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'Transfer-Encoding': 'chunked'
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] API: 处理请求出错:`, error);
    return NextResponse.json(
      { error: `处理失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    )
  }
}

// 处理OpenAI兼容API的文件请求
async function handleOpenAIFileRequest(
  fileIds: string[],
  model: string,
  apiKey: string,
  baseURL: string,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  console.log(`[${new Date().toISOString()}] API: 创建OpenAI客户端`);
  // 创建 OpenAI 客户端
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL
  })
  
  // 构建消息，引用已上传的文件
  const messages = [
    { role: 'system', content: 'You are a helpful assistant that converts requirement documents to Markdown format.' },
    ...fileIds.map((id: string) => ({ role: 'system', content: `fileid://${id}` })),
    { role: 'user', content: requirementToMdPrompt }
  ]
  
  console.log(`[${new Date().toISOString()}] API: 发送到OpenAI API`);
  
  // 创建流式完成
  const stream = await client.chat.completions.create({
    model: model,
    messages: messages as any,
    stream: true,
    temperature: 0.7,
    max_tokens: 4000
  })
  
  console.log(`[${new Date().toISOString()}] API: 开始接收OpenAI流式响应`);
  
  let chunkCounter = 0;
  
  // 处理流
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    chunkCounter++;
    
    if (content) {
      // 确保每个内容块都被立即发送
      await writer.write(new TextEncoder().encode(content));
    }
  }
  
  console.log(`[${new Date().toISOString()}] API: 流式响应接收完成，共处理${chunkCounter}个数据块`);
  await writer.close();
}

// 处理Google Gemini模型的文件请求
async function handleGeminiFileRequest(
  fileIds: string[],
  model: string,
  apiKey: string,
  writer: WritableStreamDefaultWriter<Uint8Array>
) {
  try {
    console.log(`[${new Date().toISOString()}] API: 处理Gemini文件请求，模型=${model}`);
    
    // 初始化Google Generative AI客户端
    console.log(`[${new Date().toISOString()}] API: 初始化Google Generative AI客户端`);
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log(`[${new Date().toISOString()}] API: 获取模型 ${model}`);
    const genModel = genAI.getGenerativeModel({ model });
    
    // 创建文件管理器以获取文件元数据
    const fileManager = new GoogleAIFileManager(apiKey);
    
    // 准备内容数组
    const contents = [];
    
    // 添加提示文本
    contents.push(requirementToMdPrompt);
    
    // 获取并添加文件
    for (const fileId of fileIds) {
      try {
        if (!fileId) {
          console.error(`[${new Date().toISOString()}] API: 文件ID为空`);
          continue;
        }
        
        console.log(`[${new Date().toISOString()}] API: 处理文件ID: ${fileId}`);
        
        // 获取文件元数据
        const fileMetadata = await fileManager.getFile(fileId);
        if (!fileMetadata) {
          console.error(`[${new Date().toISOString()}] API: 未找到文件元数据: ${fileId}`);
          continue;
        }
        
        console.log(`[${new Date().toISOString()}] API: 文件元数据获取成功，URI: ${fileMetadata.uri}`);
        
        // 添加文件对象到内容数组
        const fileContent = {
          fileData: {
            fileUri: fileMetadata.uri,
            mimeType: fileMetadata.mimeType || 'application/octet-stream'
          }
        };
        console.log(`[${new Date().toISOString()}] API: 添加文件内容:`, JSON.stringify(fileContent, null, 2));
        contents.push(fileContent);
      } catch (fileError) {
        console.error(`[${new Date().toISOString()}] API: 获取文件元数据失败:`, fileError);
        await writer.write(new TextEncoder().encode(`\n\n获取文件元数据失败: ${fileError instanceof Error ? fileError.message : '未知错误'}\n`));
      }
    }
    
    if (contents.length <= 1) {
      console.error(`[${new Date().toISOString()}] API: 没有有效的文件内容`);
      await writer.write(new TextEncoder().encode(`\n\n错误: 没有有效的文件内容\n`));
      await writer.close();
      return;
    }
    
    console.log(`[${new Date().toISOString()}] API: 准备调用Gemini API，contents数组:`, JSON.stringify(contents, null, 2));
    
    // 调用Gemini API
    console.log(`[${new Date().toISOString()}] API: 调用Gemini API生成内容`);
    const result = await genModel.generateContentStream(contents);
    
    console.log(`[${new Date().toISOString()}] API: 开始接收Gemini响应流`);
    
    // 处理流式响应
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        await writer.write(new TextEncoder().encode(chunkText));
      }
    }
    
    console.log(`[${new Date().toISOString()}] API: Gemini响应流处理完成`);
    await writer.close();
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 处理Gemini文件请求失败:`, error);
    try {
      await writer.write(new TextEncoder().encode(`\n\n错误: ${error instanceof Error ? error.message : '未知错误'}`));
      await writer.close();
    } catch (writerError) {
      console.error(`[${new Date().toISOString()}] 写入错误信息时出错:`, writerError);
    }
  }
} 