import { NextRequest, NextResponse } from "next/server";
import { QwenVLService } from "@/lib/services/qwen-vl-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 明确指定使用Node.js运行时
export const maxDuration = 60; // 设置最大执行时间为60秒

/**
 * 图像处理API
 * 接收图像URL和提示词，调用通义千问VL模型进行分析，返回流式响应
 */
export async function POST(req: Request): Promise<Response> {
  try {
    console.log('✨ [AI图像API] 开始处理图像分析请求...');
    
    // 解析表单数据
    const formData = await req.formData();
    
    // 获取图像URL列表
    const imageUrls = formData.getAll('imageUrls') as string[];
    if (!imageUrls || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: '未提供图像URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('✨ [AI图像API] 接收到图像URL数量:', imageUrls.length);
    
    // 获取提示词
    const prompt = formData.get('prompt') as string;
    if (!prompt) {
      return new Response(JSON.stringify({ error: '未提供提示词' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('✨ [AI图像API] 提示词长度:', prompt.length);
    
    // 获取可选的系统提示词
    const systemPrompt = formData.get('systemPrompt') as string || undefined;
    if (systemPrompt) {
      console.log('✨ [AI图像API] 系统提示词长度:', systemPrompt.length);
    }
    
    // 获取模型配置
    const modelConfig = await aiModelConfigService.getDefaultConfig();
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: '未找到默认模型配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✨ [AI图像API] 获取到模型配置, 模型名称:', modelConfig.model);
    console.log('✨ [AI图像API] API密钥长度:', modelConfig.apiKey.length);
    console.log('✨ [AI图像API] API密钥前5个字符:', modelConfig.apiKey.substring(0, 5));
    
    // 创建通义千问VL服务
    const vlService = new QwenVLService();
    
    // 处理图像请求并流式返回
    return await vlService.analyzeImages(imageUrls, prompt, modelConfig, systemPrompt);
  } catch (error) {
    console.error('🔴 [AI图像API] 处理图像分析请求出错:', error);
    return new Response(JSON.stringify({ error: '处理图像请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 