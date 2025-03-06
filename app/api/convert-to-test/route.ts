import { NextRequest, NextResponse } from 'next/server'
import { requirementToTestPrompt } from '@/lib/prompts/requirement-to-test'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'edge' // 使用Edge运行时以获得更好的流式处理能力

export async function POST(request: NextRequest) {
  try {
    console.log(`[${new Date().toISOString()}] API: 收到需求转测试用例请求`);
    const { fileIds, apiConfig, requirementChapter } = await request.json()
    
    if (!fileIds || !fileIds.length) {
      return NextResponse.json(
        { error: '请提供文件ID' },
        { status: 400 }
      )
    }
    
    if (!apiConfig) {
      return NextResponse.json(
        { error: '请提供API配置' },
        { status: 400 }
      )
    }
    
    const { model, apiKey, baseURL } = apiConfig
    
    if (!model || !apiKey || !baseURL) {
      return NextResponse.json(
        { error: 'API配置不完整' },
        { status: 400 }
      )
    }
    
    console.log(`[${new Date().toISOString()}] API: 创建OpenAI客户端`);
    // 创建 OpenAI 客户端
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    })
    
    // 执行流式响应
    const encoder = new TextEncoder();
    const responseStream = new TransformStream()
    const writer = responseStream.writable.getWriter()
    
    // 异步处理流
    const streamResponse = async () => {
      try {
        // 准备消息内容
        console.log(`[${new Date().toISOString()}] API: 处理请求，模型=${model}, 文件数=${fileIds.length}`);
        
        // 构建消息，引用已上传的文件
        const messages = [
          { role: 'system', content: 'You are a helpful assistant that generates test cases from requirement documents.' },
          ...fileIds.map((id: string) => ({ role: 'system', content: `fileid://${id}` })),
          { role: 'user', content: requirementToTestPrompt(requirementChapter) }
        ]
        
        console.log(`[${new Date().toISOString()}] API: 发送到OpenAI API`);
        
        // 先发送一些初始内容，确保流式处理开始
        await writer.write(encoder.encode("开始生成测试用例...\n\n"));
        
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
            console.log(`[${new Date().toISOString()}] API: 收到内容块#${chunkCounter}, 长度=${content.length}`);
            // 确保每个内容块都被立即发送
            await writer.write(encoder.encode(content));
          }
        }
        
        console.log(`[${new Date().toISOString()}] API: 流式响应接收完成，共处理${chunkCounter}个数据块`);
        await writer.write(encoder.encode("\n\n测试用例生成完毕。"));
        await writer.close();
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