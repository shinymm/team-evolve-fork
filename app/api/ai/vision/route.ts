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
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[Vision API] - Received request');
  try {
    // 解析请求数据 - 改为解析JSON
    console.log('[Vision API] - Parsing JSON body...');
    const { imageUrls, prompt, systemPrompt, modelConfigId } = await request.json();
    console.log('[Vision API] - JSON body parsed successfully.');
    
    // 验证输入
    if (!prompt) {
      return NextResponse.json({ error: '请提供提示词' }, { status: 400 });
    }

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: '请至少提供一张图片' }, { status: 400 });
    }

    console.log('[Vision API] - Inputs validated. Image count:', imageUrls.length);

    // 获取模型配置
    let modelConfig;
    console.log('[Vision API] - Getting model configuration...');
    if (modelConfigId) {
      modelConfig = await aiModelConfigService.getConfigById(modelConfigId);
      if (!modelConfig) {
        console.log('[Vision API] - Specified model config not found, falling back to default.');
      }
    }

    // 如果没有提供特定模型或找不到指定模型，使用默认视觉模型配置
    if (!modelConfig) {
      modelConfig = await aiModelConfigService.getDefaultVisionConfig();
      
      if (!modelConfig) {
        console.log('[Vision API] - Default vision model config not found, trying default language model.');
        modelConfig = await aiModelConfigService.getDefaultConfig();
      }

      if (!modelConfig) {
        console.error('[Vision API] - CRITICAL: No usable AI model configuration found.');
        return NextResponse.json({ error: '未找到可用的AI模型配置' }, { status: 500 });
      }
    }

    console.log('[Vision API] - Using model config:', {
      id: modelConfig.id,
      name: modelConfig.name,
      model: modelConfig.model
    });

    // 根据模型类型选择服务
    if (modelConfig.model.startsWith('qvq')) {
      console.log('[Vision API] - Model is QVQ type. Initializing QVQModelService...');
      // 使用QVQ模型服务（带思考过程）
      const qvqService = new QVQModelService();
      const response = await qvqService.analyzeImage(imageUrls, prompt, modelConfig, systemPrompt);
      console.log('[Vision API] - QVQ service returned response. Streaming back to client.');
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } else {
      console.log('[Vision API] - Model is VL type. Initializing QwenVLService...');
      // 默认使用通义千问VL服务
      const visionService = new QwenVLService();
      const response = await visionService.analyzeImages(imageUrls, prompt, modelConfig, systemPrompt);
      console.log('[Vision API] - VL service returned response. Streaming back to client.');
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (error) {
    console.error('[Vision API] - CRITICAL ERROR in POST handler:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '处理视觉请求时发生错误' 
    }, { status: 500 });
  }
} 