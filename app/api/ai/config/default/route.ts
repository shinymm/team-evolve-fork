import { NextRequest, NextResponse } from "next/server";
import { aiModelConfigService } from "@/lib/services/ai-model-config-service";

export const dynamic = "force-dynamic";

/**
 * 获取默认AI模型配置
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const config = await aiModelConfigService.getDefaultConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: "未找到默认模型配置" },
        { status: 404 }
      );
    }
    
    // 返回安全的配置信息（不包含API密钥）
    return NextResponse.json({
      id: config.id,
      name: config.name,
      model: config.model,
      temperature: config.temperature,
      isDefault: config.isDefault,
      createdAt: config.createdAt
    });
  } catch (error) {
    console.error("获取默认配置失败:", error);
    return NextResponse.json(
      { error: "获取默认配置失败" },
      { status: 500 }
    );
  }
} 