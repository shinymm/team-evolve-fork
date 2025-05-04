import { RequirementAnalysisTemplateData } from '../prompts/requirement-analysis';

/**
 * 系统信息服务 - 处理系统相关的信息获取与格式化
 */
export class SystemInfoService {
  /**
   * 获取系统的产品信息
   * @param systemId 系统ID
   * @returns 产品信息对象
   */
  public static async getSystemProductInfo(systemId: string): Promise<any> {
    if (!systemId) {
      console.log('未提供系统ID，无法获取系统信息');
      return null;
    }
    
    try {
      const response = await fetch(`/api/systems/${systemId}/product-info`);
      if (!response.ok) {
        throw new Error(`获取系统信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取系统产品信息失败:', error);
      return null;
    }
  }
  
  /**
   * 为需求分析提示词准备模板数据
   * @param systemId 系统ID
   * @returns 模板数据对象
   */
  public static async prepareRequirementAnalysisTemplateData(
    systemId: string
  ): Promise<RequirementAnalysisTemplateData | undefined> {
    if (!systemId) {
      console.log('未提供系统ID，无法准备提示词模板数据');
      return undefined;
    }
    
    try {
      const productInfo = await this.getSystemProductInfo(systemId);
      if (!productInfo) {
        console.log('未获取到系统产品信息，使用默认模板');
        return undefined;
      }
      
      // 系统概述
      const productOverview = productInfo.overview || '';
      
      // 格式化用户画像
      const userPersonas = this.formatUserPersonas(productInfo.userPersona || []);
      
      return {
        productOverview,
        userPersonas
      };
    } catch (error) {
      console.error('准备模板数据失败:', error);
      return undefined;
    }
  }
  
  /**
   * 格式化用户画像为提示词所需格式
   * @param userPersonas 用户画像数组
   * @returns 格式化后的用户画像文本
   */
  private static formatUserPersonas(userPersonas: any[]): string {
    if (!Array.isArray(userPersonas) || userPersonas.length === 0) {
      return '   - 请描述系统的主要用户群体及其特征和需求特点';
    }
    
    return userPersonas.map(persona => {
      const name = persona.name || '未命名用户群体';
      const description = persona.description || '';
      return `   - ${name}：${description}`;
    }).join('\n');
  }
} 