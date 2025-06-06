/**
 * 图片分析处理相关类型定义
 */

// 标签页类型定义
export type TabType = 'product-info' | 'architecture' | 'vision-analysis';

// 上传文件类型定义
export interface UploadedFile {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;
  provider: string;
  url?: string;
}

// 分析内容类型
export interface AnalysisContents {
  'product-info': string;
  'architecture': string;
  'vision-analysis': string;
}

// 推理过程内容类型
export interface ReasoningContents {
  'product-info': string;
  'architecture': string;
  'vision-analysis': string;
}

// 推理过程可见性类型
export interface ReasoningVisibility {
  'product-info': boolean;
  'architecture': boolean;
  'vision-analysis': boolean;
}

// 处理状态类型
export interface ProcessingStates {
  'product-info': boolean;
  'architecture': boolean;
  'vision-analysis': boolean;
} 