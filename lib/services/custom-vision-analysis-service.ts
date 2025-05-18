import { customVisionAnalysisPrompt, systemRoleTemplate } from '@/lib/prompts/custom-vision-analysis'
import { VisionService } from './vision-service'

/**
 * 系统信息接口
 */
export interface SystemInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * 自定义视觉分析服务
 */
export class CustomVisionAnalysisService {
  /**
   * 使用自定义提示词分析图片
   * @param imageUrls 图片URL列表
   * @param customPrompt 自定义提示词
   * @param onContent 普通内容流式回调
   * @param onReasoning 推理过程内容流式回调
   * @param systemInfo 系统信息
   */
  async analyzeWithCustomPrompt(
    imageUrls: string[],
    customPrompt: string,
    onContent: (content: string) => void,
    onReasoning?: (content: string) => void,
    systemInfo?: SystemInfo
  ): Promise<void> {
    try {
      if (imageUrls.length === 0) {
        throw new Error('请至少选择一个图片文件进行分析')
      }

      console.log('处理图片文件，图片URL数量:', imageUrls.length);
      
      // 构建提示词
      const prompt = this.buildPrompt(customPrompt, systemInfo);
      
      // 构建系统角色提示
      const systemPrompt = systemRoleTemplate;
      
      // 使用VisionService处理
      const visionService = new VisionService();
      await visionService.analyzeImage(
        imageUrls,
        prompt,
        onReasoning || (() => {}),
        onContent,
        systemPrompt
      );
    } catch (error) {
      console.error(`视觉分析失败:`, error)
      throw error
    }
  }
  
  /**
   * 构建完整提示词，替换所有占位符
   * @param customPrompt 用户自定义提示词
   * @param systemInfo 系统信息
   * @returns 完整提示词
   */
  private buildPrompt(customPrompt: string, systemInfo?: SystemInfo): string {
    // 复制模板
    let finalPrompt = customVisionAnalysisPrompt;
    
    // 替换用户提示词
    finalPrompt = finalPrompt.replace('{{CUSTOM_PROMPT}}', customPrompt);
    
    // 简单替换系统信息
    if (systemInfo) {
      finalPrompt = finalPrompt.replace('{{SYSTEM_NAME}}', systemInfo.name);
      finalPrompt = finalPrompt.replace('{{SYSTEM_DESCRIPTION}}', systemInfo.description || '未提供系统描述');
      
      console.log('添加系统信息到视觉分析提示词:', {
        systemName: systemInfo.name,
        hasDescription: !!systemInfo.description
      });
    } else {
      finalPrompt = finalPrompt.replace('{{SYSTEM_NAME}}', '未知系统');
      finalPrompt = finalPrompt.replace('{{SYSTEM_DESCRIPTION}}', '未提供系统描述');
    }
    
    return finalPrompt;
  }
} 