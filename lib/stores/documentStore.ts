import { create } from 'zustand';
import { Document, UploadProgress, FileListResponse } from '@/types/document';
import { DocumentService } from '@/lib/api/documents';

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  uploadProgress: UploadProgress | null;
  isLoading: boolean;
  error: string | null;
  total: number;
  skip: number;
  limit: number;
  fetchDocuments: (skip?: number, limit?: number) => Promise<void>;
  uploadDocument: (file: File) => Promise<void>;
  getUploadProgress: (documentId: string) => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
  clearError: () => void;
  setError: (error: string) => void;
  resetState: () => void;
}

const initialState = {
  documents: [],
  currentDocument: null,
  uploadProgress: null,
  isLoading: false,
  error: null,
  total: 0,
  skip: 0,
  limit: 10,
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  ...initialState,

  fetchDocuments: async (skip = 0, limit = 10) => {
    set({ isLoading: true, error: null });
    try {
      const documentService = DocumentService.getInstance();
      const response = await documentService.getDocuments(skip, limit);
      if (response.status === 'success' && response.data) {
        // 将文件列表转换为 Document 格式
        const documents = response.data.files.map(file => ({
          id: file.id.toString(),
          filename: file.filename,
          file_url: file.file_url,
          object_key: file.file_url.split('/').pop() || '',
          content_type: file.content_type,
          status: 'uploaded' as const,
          progress: 100,
          issues: 0,
          fixed: 0,
          created_at: file.created_at,
          updated_at: file.created_at
        }));

        set({ 
          documents,
          total: response.data.total,
          skip: response.data.skip,
          limit: response.data.limit
        });
      } else {
        set({ error: response.message || '获取文档列表失败' });
      }
    } catch (error) {
      console.error('Error in fetchDocuments:', error);
      set({ error: error instanceof Error ? error.message : '获取文档列表失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  uploadDocument: async (file: File) => {
    set({ isLoading: true, error: null });
    try {
      // Validate file type
      if (!file.type.match(/^application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/)) {
        set({ 
          error: '仅支持 Word 文档格式',
          isLoading: false 
        });
        return;
      }

      const documentService = DocumentService.getInstance();
      const response = await documentService.uploadDocument(file);
      
      if (response.data.success && response.data.file_url) {
        const newDocument: Document = {
          id: response.data.file_id.toString(),
          filename: response.data.filename,
          file_url: response.data.file_url,
          object_key: response.data.object_key,
          content_type: file.type,
          status: 'uploaded',
          progress: 0,
          issues: 0,
          fixed: 0,
          created_at: response.data.created_at,
          updated_at: response.data.created_at
        };
        
        // 更新文档列表和状态
        set(state => ({
          documents: [newDocument, ...state.documents],
          currentDocument: newDocument,
          uploadProgress: {
            progress: 100,
            status: 'completed',
            message: '上传完成'
          },
          isLoading: false,
          total: state.total + 1
        }));

        // 开始轮询上传进度
        get().getUploadProgress(newDocument.id);
      } else {
        set({ 
          error: '上传失败，请重试',
          isLoading: false,
          uploadProgress: {
            progress: 0,
            status: 'error',
            message: '上传失败'
          }
        });
      }
    } catch (error) {
      console.error('Error in uploadDocument:', error);
      set({ 
        error: error instanceof Error ? error.message : '上传失败，请重试',
        isLoading: false,
        uploadProgress: {
          progress: 0,
          status: 'error',
          message: '上传失败'
        }
      });
    }
  },

  getUploadProgress: async (documentId: string) => {
    try {
      const documentService = DocumentService.getInstance();
      const response = await documentService.getUploadProgress(documentId);
      
      if (response.status === 'success' && response.data) {
        set({ uploadProgress: response.data });
        
        // 只有在状态为 uploading 或 processing 时才继续轮询
        if (response.data.status === 'uploading' || response.data.status === 'processing') {
          setTimeout(() => get().getUploadProgress(documentId), 1000);
        }
      } else {
        // 如果获取进度失败，假设上传已完成
        set({ 
          uploadProgress: {
            progress: 100,
            status: 'completed',
            message: '上传完成'
          }
        });
      }
    } catch (error) {
      console.error('Error in getUploadProgress:', error);
      // 如果获取进度失败，假设上传已完成
      set({ 
        uploadProgress: {
          progress: 100,
          status: 'completed',
          message: '上传完成'
        }
      });
    }
  },

  setCurrentDocument: (document) => {
    set({ currentDocument: document });
  },

  setError: (error: string) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  resetState: () => {
    set(initialState);
  },
})); 