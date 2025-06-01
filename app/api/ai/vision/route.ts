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
  try {
    // 解析请求数据
    const formData = await request.formData();
    
    let imageUrls: string[] = [];
    const imageUrlsFormData = formData.getAll('imageUrls'); // Returns FormDataEntryValue[]

    if (imageUrlsFormData.length > 0) {
      const firstEntry = imageUrlsFormData[0]; // Assuming the stringified array is the first entry
      if (typeof firstEntry === 'string') {
        try {
          const parsed = JSON.parse(firstEntry);
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            imageUrls = parsed;
          } else {
            // This case handles if the frontend accidentally sends a non-array JSON or an array of non-strings
            console.error('Parsed imageUrls is not an array of strings:', parsed);
            return NextResponse.json({ error: 'Invalid imageUrls format: Expected a JSON array of URL strings.' }, { status: 400 });
          }
        } catch (e) {
          // This case handles if the string is not valid JSON
          console.error('Error parsing imageUrls JSON string:', firstEntry, e);
          // If it's not JSON, it might be a single URL string directly (though current frontend sends JSON string for test)
          // For now, strictly expect JSON array string as per test case.
          return NextResponse.json({ error: 'Malformed imageUrls parameter: Not a valid JSON string.' }, { status: 400 });
        }
      } else {
        // This case handles if the FormData entry is a File, not a string
        console.error('imageUrls FormData entry is not a string:', firstEntry);
        return NextResponse.json({ error: 'Invalid imageUrls format: Expected a string.' }, { status: 400 });
      }
    }
    // If imageUrlsFormData is empty, the check `if (imageUrls.length === 0)` later will handle it.

    const prompt = formData.get('prompt')?.toString() || '';
    const systemPrompt = formData.get('systemPrompt')?.toString();
    const modelConfigId = formData.get('modelConfig')?.toString();

    // 验证输入
    if (!prompt) {
      return NextResponse.json({ error: '请提供提示词' }, { status: 400 });
    }

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: '请至少提供一张图片' }, { status: 400 });
    }

    console.log('处理图像分析请求:', {
      imageCount: imageUrls.length,
      promptLength: prompt.length,
      hasSystemPrompt: !!systemPrompt,
      providedModelId: modelConfigId
    });

    // 获取模型配置
    let modelConfig;
    if (modelConfigId) {
      modelConfig = await aiModelConfigService.getConfigById(modelConfigId);
      if (!modelConfig) {
        console.log('未找到指定模型配置，使用默认配置');
      }
    }

    // 如果没有提供特定模型或找不到指定模型，使用默认视觉模型配置
    if (!modelConfig) {
      modelConfig = await aiModelConfigService.getDefaultVisionConfig();
      
      if (!modelConfig) {
        console.log('未找到默认视觉模型配置，尝试使用默认语言模型配置');
        modelConfig = await aiModelConfigService.getDefaultConfig();
      }

      if (!modelConfig) {
        return NextResponse.json({ error: '未找到可用的AI模型配置' }, { status: 500 });
      }
    }

    console.log('使用模型配置:', {
      id: modelConfig.id,
      name: modelConfig.name,
      model: modelConfig.model
    });

    // 根据模型类型选择服务
    if (modelConfig.model.startsWith('qvq')) {
      // 使用QVQ模型服务（带思考过程）
      const qvqService = new QVQModelService();
      const response = await qvqService.analyzeImage(imageUrls, prompt, modelConfig, systemPrompt);
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } else {
      // 默认使用通义千问VL服务
      const visionService = new QwenVLService();
      const response = await visionService.analyzeImages(imageUrls, prompt, modelConfig, systemPrompt);
      // 转换为Response为NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
  } catch (error) {
    console.error('视觉API处理错误:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '处理视觉请求时发生错误' 
    }, { status: 500 });
  }
} 