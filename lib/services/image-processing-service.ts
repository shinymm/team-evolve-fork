/**
 * 图片处理服务
 * 整合各个视觉分析服务，提供统一接口
 */

import { ImageToProductInfoService } from '@/lib/services/image-to-product-info-service';
import { ImageToArchitectureService } from '@/lib/services/image-to-architecture-service';
import { CustomVisionAnalysisService } from '@/lib/services/custom-vision-analysis-service';
import { RequirementFromPrototypeService } from '@/lib/services/requirement-from-prototype-service';

// 导入SystemInfo类型
interface SystemInfo {
  id: string;
  name: string;
  description?: string;
}

/**
 * 图片处理服务
 */
export class ImageProcessingService {
  /**
   * 提取产品基础信息
   */
  async extractProductInfo(
    imageUrls: string[],
    onAnswerContent: (content: string) => void,
    onReasoningContent: (content: string) => void,
    systemInfo?: SystemInfo,
    supplementText?: string
  ): Promise<void> {
    if (imageUrls.length === 0) {
      throw new Error('请至少选择一个图片文件');
    }
    
    const service = new ImageToProductInfoService();
    await service.extractProductInfo(
      imageUrls,
      onAnswerContent,
      onReasoningContent,
      systemInfo,
      supplementText
    );
  }

  /**
   * 提取信息架构
   */
  async extractArchitecture(
    imageUrls: string[],
    onAnswerContent: (content: string) => void,
    onReasoningContent: (content: string) => void,
    systemInfo?: SystemInfo,
    supplementText?: string
  ): Promise<void> {
    if (imageUrls.length === 0) {
      throw new Error('请至少选择一个图片文件');
    }
    
    const service = new ImageToArchitectureService();
    await service.extractArchitecture(
      imageUrls,
      onAnswerContent,
      onReasoningContent,
      systemInfo,
      supplementText
    );
  }

  /**
   * 自定义视觉分析
   */
  async analyzeWithCustomPrompt(
    imageUrls: string[],
    customPrompt: string,
    onAnswerContent: (content: string) => void,
    onReasoningContent: (content: string) => void,
    systemInfo?: SystemInfo
  ): Promise<void> {
    if (imageUrls.length === 0) {
      throw new Error('请至少选择一个图片文件');
    }

    if (!customPrompt) {
      throw new Error('请提供分析提示词');
    }
    
    const service = new CustomVisionAnalysisService();
    await service.analyzeWithCustomPrompt(
      imageUrls,
      customPrompt,
      onAnswerContent,
      onReasoningContent,
      systemInfo
    );
  }

  /**
   * 生成需求初稿
   */
  async generateRequirementDraft(
    systemId: string,
    imageUrls: string[],
    requirementOverview: string,
    onReasoningContent: (content: string) => void,
    onAnswerContent: (content: string) => void
  ): Promise<void> {
    if (imageUrls.length === 0) {
      throw new Error('请至少选择一个图片文件');
    }

    if (!requirementOverview.trim()) {
      throw new Error('需求概述不能为空');
    }

    if (!systemId) {
      throw new Error('未找到当前系统ID，请先选择一个系统');
    }
    
    const service = new RequirementFromPrototypeService();
    await service.generateRequirementFromPrototype(
      systemId,
      imageUrls,
      requirementOverview,
      onReasoningContent,
      onAnswerContent
    );
  }
} 