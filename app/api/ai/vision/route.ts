import { NextRequest, NextResponse } from "next/server";
import { QwenVLService } from "@/lib/services/qwen-vl-service";
import { QVQModelService } from "@/lib/services/qwen-qvq-service";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 视觉模型处理API
 * 支持普通视觉理解模型(VL)和推理型视觉模型(QVQ)
 */
export async function POST(req: Request): Promise<Response> {
  try {
    console.log('✨ [视觉API] 开始处理视觉分析请求...');
    
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
    console.log('✨ [视觉API] 接收到图像URL数量:', imageUrls.length);
    
    // 获取提示词
    const prompt = formData.get('prompt') as string;
    if (!prompt) {
      return new Response(JSON.stringify({ error: '未提供提示词' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log('✨ [视觉API] 提示词长度:', prompt.length);
    
    // 获取可选的系统提示词
    const systemPrompt = formData.get('systemPrompt') as string || undefined;
    if (systemPrompt) {
      console.log('✨ [视觉API] 系统提示词长度:', systemPrompt.length);
    }
    
    // 获取模型配置
    const modelConfig = await aiModelConfigService.getDefaultConfig();
    if (!modelConfig) {
      return new Response(JSON.stringify({ error: '未找到默认模型配置' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✨ [视觉API] 获取到模型配置, 模型名称:', modelConfig.model);
    
    // 根据模型名称判断是否为推理型视觉模型
    const isQVQModel = modelConfig.model.includes('qvq');
    console.log(`✨ [视觉API] 使用${isQVQModel ? '推理型' : '普通'}视觉模型`);
    
    // 根据模型类型选择对应的处理服务
    if (isQVQModel) {
      // 创建QVQ视觉推理服务
      const qvqService = new QVQModelService();
      return await qvqService.analyzeImage(imageUrls, prompt, modelConfig, systemPrompt);
    } else {
      // 创建普通视觉理解服务
      const vlService = new QwenVLService();
      return await vlService.analyzeImages(imageUrls, prompt, modelConfig, systemPrompt);
    }
  } catch (error) {
    console.error('🔴 [视觉API] 处理视觉分析请求出错:', error);
    return new Response(JSON.stringify({ error: '处理视觉请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 