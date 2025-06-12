import { ApiClient } from './client';
import { Document, UploadResponse, UploadProgress, FileListResponse } from '@/types/document';
import { ApiResponse } from '@/types/api';

export class DocumentService {
  private static instance: DocumentService;
  private apiClient: ApiClient;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }

  async getDocuments(skip: number = 0, limit: number = 10, userId): Promise<ApiResponse<FileListResponse>> {
    try {
      const response = await this.apiClient.get<FileListResponse>(`/upload/files/user/${userId}?skip=${skip}&limit=${limit}`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching documents:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '获取文档列表失败',
        data: {
          total: 0,
          skip: 0,
          limit: 0,
          files: []
        }
      };
    }
  }

  async uploadDocument(file: File, userId: string): Promise<ApiResponse<UploadResponse>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      // formData.append('userId', file);

      const response = await this.apiClient.post<UploadResponse>(`upload/upload?user_id=${userId}`, formData);
      
      return {
        status: response.data.success ? 'success' : 'error',
        data: response.data,
        message: response.data.message
      };
    } catch (error) {
      console.error('Upload document error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '上传文档失败',
        data: {
          success: false,
          file_url: '',
          object_key: '',
          filename: '',
          file_id: 0,
          created_at: new Date().toISOString()
        }
      };
    }
  }

  async getUploadProgress(documentId: string): Promise<ApiResponse<UploadProgress>> {
    try {
      const response = await this.apiClient.get<UploadProgress>(`documents/${documentId}/progress`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      console.error('Error getting upload progress:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '获取上传进度失败',
        data: {
          progress: 0,
          status: 'error',
          message: '获取进度失败'
        }
      };
    }
  }

  async getDocument(documentId: string): Promise<ApiResponse<Document>> {
    try {
      const response = await this.apiClient.get<Document>(`documents/${documentId}`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      console.error('Error getting document:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : '获取文档失败',
        data: {
          id: '',
          filename: '',
          file_url: '',
          object_key: '',
          content_type: '',
          status: 'uploaded',
          progress: 0,
          issues: 0,
          fixed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
    }
  }

  // 临时模拟数据，后续会移除
  private mockDocuments: Document[] = [
    {
      id: "doc1",
      filename: "智能驾驶系统PRD_v1.2.0.docx",
      file_url: "https://example.com/docs/doc1.docx",
      object_key: "uploads/doc1.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "completed",
      progress: 100,
      issues: 12,
      fixed: 8,
      created_at: "2025-05-25T10:00:00Z",
      updated_at: "2025-05-25T10:00:00Z"
    },
    {
      id: "doc2",
      filename: "自动泊车功能需求说明_v0.9.docx",
      file_url: "https://example.com/docs/doc2.docx",
      object_key: "uploads/doc2.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "reviewing",
      progress: 60,
      issues: 15,
      fixed: 5,
      created_at: "2025-05-27T10:00:00Z",
      updated_at: "2025-05-27T10:00:00Z"
    },
    {
      id: "doc3",
      filename: "智能座舱交互需求_v1.0.docx",
      file_url: "https://example.com/docs/doc3.docx",
      object_key: "uploads/doc3.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "analyzing",
      progress: 30,
      issues: 7,
      fixed: 0,
      created_at: "2025-05-28T10:00:00Z",
      updated_at: "2025-05-28T10:00:00Z"
    },
    {
      id: "doc4",
      filename: "ADAS功能规格说明_v2.1.docx",
      file_url: "https://example.com/docs/doc4.docx",
      object_key: "uploads/doc4.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      status: "uploaded",
      progress: 0,
      issues: 0,
      fixed: 0,
      created_at: "2025-05-29T10:00:00Z",
      updated_at: "2025-05-29T10:00:00Z"
    }
  ];

  // 临时返回模拟数据，后续会替换为实际的 API 调用
  async getMockDocuments(): Promise<ApiResponse<Document[]>> {
    return Promise.resolve({
      data: this.mockDocuments,
      status: 'success',
      message: 'Documents retrieved successfully'
    });
  }
}

// 添加模拟数据
const mockData = {
  '/documents': [
    {
      id: "doc1",
      title: "智能驾驶系统PRD_v1.2.0",
      uploadDate: "2025-05-25",
      status: "completed",
      progress: 100,
      issues: 12,
      fixed: 8,
    },
    {
      id: "doc2",
      title: "自动泊车功能需求说明_v0.9",
      uploadDate: "2025-05-27",
      status: "reviewing",
      progress: 60,
      issues: 15,
      fixed: 5,
    }
  ]
}; 