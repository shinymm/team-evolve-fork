/**
 * 系统知识服务 - 提供获取系统产品知识的功能
 */
export class SystemKnowledgeService {
  /**
   * 获取系统的产品知识
   * @param systemId 系统ID
   * @returns 格式化后的产品知识对象
   */
  public static async getSystemKnowledge(systemId: string) {
    if (!systemId) {
      console.log('未提供系统ID，无法获取系统知识');
      return {
        productOverview: '',
        userPersonas: '',
        architectureInfo: ''
      };
    }
    
    try {
      const response = await fetch(`/api/systems/${systemId}/product-info`);
      if (!response.ok) {
        throw new Error(`获取系统信息失败: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 格式化系统概述
      const productOverview = data.overview || '';
      
      // 格式化用户画像信息
      const userPersonas = this.formatUserPersonas(data.userPersona || []);
      
      // 格式化信息架构
      const architectureInfo = this.formatArchitecture(data.architecture || []);
      
      return {
        productOverview,
        userPersonas,
        architectureInfo
      };
    } catch (error) {
      console.error('获取系统产品知识失败:', error);
      return {
        productOverview: '',
        userPersonas: '',
        architectureInfo: ''
      };
    }
  }
  
  /**
   * 格式化用户画像信息
   * @param userPersona 用户画像数据
   * @returns 格式化后的用户画像文本
   */
  private static formatUserPersonas(userPersona: any[]): string {
    if (!userPersona || userPersona.length === 0) {
      return '';
    }
    
    return userPersona.map((persona, index) => {
      const title = persona.title || `用户角色${index + 1}`;
      const features = persona.features || '';
      const needs = persona.needs || '';
      
      return `角色: ${title}\n特征: ${features}\n需求: ${needs}`;
    }).join('\n\n');
  }
  
  /**
   * 格式化信息架构
   * @param architecture 信息架构数据
   * @returns 格式化后的信息架构文本
   */
  private static formatArchitecture(architecture: any[]): string {
    if (!architecture || architecture.length === 0) {
      return '';
    }
    
    // 构建树状结构
    const buildTree = (items: any[], parentId: string | null = null): any[] => {
      return items
        .filter(item => item.parentId === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.id)
        }));
    };
    
    const tree = buildTree(architecture);
    
    // 递归格式化树状结构
    const formatTree = (nodes: any[], level = 0): string => {
      if (!nodes || nodes.length === 0) {
        return '';
      }
      
      const indent = '  '.repeat(level);
      
      return nodes.map(node => {
        const title = node.title || '';
        const description = node.description ? `: ${node.description}` : '';
        const children = node.children && node.children.length > 0 
          ? `\n${formatTree(node.children, level + 1)}`
          : '';
          
        return `${indent}- ${title}${description}${children}`;
      }).join('\n');
    };
    
    return formatTree(tree);
  }
} 