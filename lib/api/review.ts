import { ApiClient } from './client';
import { ApiResponse } from '@/types/api';

// 类型定义（可根据后端实际结构调整）
type WordRun = {
  text: string;
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  font_size?: number | null;
  font_name?: string | null;
  color?: [number, number, number] | null;
};

export type WordSection = {
  type: "heading" | "paragraph" | "table";
  level?: number;
  text?: string;
  runs?: WordRun[];
  content?: WordSection[];
  rows?: { cells: { content: WordSection[] }[] }[];
  style?: string;
  width?: number;
  height?: number;
  alignment?: "left" | "center" | "right" | "justify";
  borders?: {
    top?: boolean;
    bottom?: boolean;
    left?: boolean;
    right?: boolean;
  };
};

export type WordContent = {
  title: string;
  author?: string;
  created?: string;
  modified?: string;
  sections: WordSection[];
};

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  modifiedContent?: string;
  isModified?: boolean;
  children?: DocumentSection[];
  images?: DocumentImage[];
  level?: number;
}

export interface DocumentImage {
  id: string;
  title: string;
  url: string;
  description: string;
  type: "architecture" | "flow" | "interaction" | "other";
}

export interface FileContent {
  id: number;
  filename: string;
  file_url: string;
  content_type: string;
  created_at: string;
  content: string;
}

export interface ReviewIssue {
  id: string;
  type: "error" | "warning" | "suggestion";
  title: string;
  description: string;
  section: string;
  sectionTitle: string;
  suggestion: string;
  accepted?: boolean;
  originalContent?: string;
  modifiedContent?: string;
  rule?: string;
  ruleId?: string;
}

export class ReviewService {
  private static instance: ReviewService;
  private apiClient: ApiClient;
  private currentContent: WordContent | null = null;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  async getDocumentSections(): Promise<ApiResponse<DocumentSection[]>> {
    try {
      // 从 content 中提取文档标题和内容
      const sections: DocumentSection[] = [];
      
      // 如果已经有文档内容，直接从内容中提取
      if (this.currentContent) {
        const contentObj = typeof this.currentContent === 'string' 
          ? JSON.parse(this.currentContent) 
          : this.currentContent;

        // 递归提取标题和内容
        const extractSections = (sections: WordSection[], parentId?: string): DocumentSection[] => {
          return sections.map((section, index) => {
            const id = `section-${parentId ? parentId + '-' : ''}${index}`;
            
            // 如果是标题，创建新的章节
            if (section.type === "heading" && section.text) {
              const docSection: DocumentSection = {
                id,
                title: section.text,
                content: "", // 初始化为空字符串
                level: section.level || 1,
                children: []
              };

              // 如果有嵌套内容，处理段落内容
              if (section.content && section.content.length > 0) {
                // 提取所有段落内容
                const paragraphs = section.content
                  .filter(content => content.type === "paragraph")
                  .map(para => {
                    // 如果有 runs，使用 runs 中的文本
                    if (para.runs && para.runs.length > 0) {
                      return para.runs.map(run => run.text).join("");
                    }
                    // 否则使用 text 字段
                    return para.text || "";
                  })
                  .join("\n\n");

                docSection.content = paragraphs;

                // 处理子章节
                docSection.children = extractSections(section.content, id);
              }

              return docSection;
            }
            return null;
          }).filter((section): section is DocumentSection => section !== null);
        };

        sections.push(...extractSections(contentObj.sections));
      }

      return {
        status: 'success',
        data: sections
      };
    } catch (error) {
      console.error('Error getting document sections:', error);
      return {
        status: 'error',
        message: 'Failed to get document sections',
        data: []
      };
    }
  }

  async getReviewIssues(): Promise<ApiResponse<ReviewIssue[]>> {
    try {
      const response = await this.apiClient.get('documents/review-issues');
      return {
        data: response.data as ReviewIssue[],
        status: 'success',
        message: 'Review issues retrieved successfully'
      };
    } catch (error) {
      console.error('Error getting review issues:', error);
      return {
        data: [],
        status: 'error',
        message: 'Failed to retrieve review issues'
      };
    }
  }

  async getWordDocumentContent(fileId: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<FileContent>> {
    console.log('Calling API to get document content for fileId:', fileId);
    
    try {
      const response = await this.apiClient.get<FileContent>(
        `upload/files/${fileId}?read_content=true`,
        options
      );
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return {
          status: 'error' as const,
          message: 'Request was aborted',
          data: {} as FileContent
        };
      }
      return {
        status: 'error' as const,
        message: error instanceof Error ? error.message : '获取文档内容失败',
        data: {} as FileContent
      };
    }
  }

  async updateSectionContent(
    documentId: string,
    sectionId: string,
    content: string,
    isModified: boolean
  ): Promise<ApiResponse<DocumentSection[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [],
      status: 'success',
      message: 'Section content updated successfully'
    });
  }

  async updateIssueStatus(
    documentId: string,
    issueId: string,
    accepted: boolean
  ): Promise<ApiResponse<ReviewIssue[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [],
      status: 'success',
      message: 'Issue status updated successfully'
    });
  }
} 