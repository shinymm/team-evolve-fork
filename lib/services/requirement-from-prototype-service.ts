import { VisionService } from '@/lib/services/vision-service';
import { prototypeToRequirementPrompt, prototypeToRequirementSystemPrompt } from '@/lib/prompts/prototype-to-requirement-prompt';

export interface ProductInfo {
  overview?: string;
  userPersona?: any[];
  architecture?: any;
}

interface RequirementGenerationResult {
  content: string;
  reasoning?: string;
}

export class RequirementFromPrototypeService {
  /**
   * 根据系统ID获取需求模板
   * @param systemId 系统ID
   * @returns 需求模板内容
   */
  async getRequirementTemplate(systemId: string): Promise<string> {
    try {
      const templateUrl = `/api/requirement-templates?systemId=${encodeURIComponent(systemId)}`;
      console.log('获取需求模板:', templateUrl);
      
      const response = await fetch(templateUrl);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取需求模板失败: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.template || !data.template.content) {
        console.warn('未找到需求模板或模板内容为空');
        // 返回默认模板
        return '# 需求文档\n\n## 1. 概述\n\n## 2. 功能需求\n\n## 3. 非功能需求';
      }
      
      return data.template.content;
    } catch (error) {
      console.error('获取需求模板出错:', error);
      throw error;
    }
  }
  
  /**
   * 根据系统ID获取产品信息
   * @param systemId 系统ID
   * @returns 产品信息对象
   */
  async getProductInfo(systemId: string): Promise<ProductInfo> {
    try {
      const productInfoUrl = `/api/systems/${systemId}/product-info`;
      console.log('获取产品知识:', productInfoUrl);
      
      const response = await fetch(productInfoUrl);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取产品知识失败: ${response.status} ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('获取产品信息出错:', error);
      throw error;
    }
  }
  
  /**
   * 从原型图和需求概述生成需求初稿
   * @param systemId 系统ID
   * @param imageUrls 原型图URL列表
   * @param requirementOverview 需求概述
   * @param onReasoningUpdate 推理过程更新回调(可选)
   * @param onContentUpdate 内容更新回调(可选)
   * @returns 生成的需求初稿
   */
  async generateRequirementFromPrototype(
    systemId: string,
    imageUrls: string[],
    requirementOverview: string,
    onReasoningUpdate?: (content: string) => void,
    onContentUpdate?: (content: string) => void
  ): Promise<RequirementGenerationResult> {
    try {
      console.log('开始从原型图生成需求初稿...');
      console.log('需求概述长度:', requirementOverview.length, '字符');
      console.log('图片URL数量:', imageUrls.length);
      
      // 1. 获取需求模板
      const template = await this.getRequirementTemplate(systemId);
      console.log('获取到需求模板，长度:', template.length, '字符');
      
      // 2. 获取产品知识
      const productInfo = await this.getProductInfo(systemId);
      console.log('获取到产品知识');
      
      // 3. 构建完整提示词
      const filledPrompt = prototypeToRequirementPrompt
        .replace('{{requirementOverview}}', requirementOverview)
        .replace('{{productOverview}}', productInfo.overview || '未提供产品概述')
        .replace('{{userPersona}}', JSON.stringify(productInfo.userPersona || []))
        .replace('{{architecture}}', JSON.stringify(productInfo.architecture || {}))
        .replace('{{template}}', template);
      
      console.log('提示词构建完成，长度:', filledPrompt.length, '字符');
      
      // 4. 调用视觉服务处理图片和需求生成
      let resultContent = '';
      let reasoningContent = '';
      
      const service = new VisionService();
      await service.analyzeImage(
        imageUrls,
        filledPrompt,
        (reasoning: string) => {
          reasoningContent = reasoning;
          if (onReasoningUpdate) {
            onReasoningUpdate(reasoning);
          }
        },
        (answer: string) => {
          resultContent = answer;
          if (onContentUpdate) {
            onContentUpdate(answer);
          }
        },
        prototypeToRequirementSystemPrompt
      );
      
      return {
        content: resultContent,
        reasoning: reasoningContent
      };
    } catch (error) {
      console.error('生成需求初稿失败:', error);
      throw error;
    }
  }
} 