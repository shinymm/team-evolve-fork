import { ApiResponse } from '@/types/api';

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private static requestCache = new Map<string, Promise<any>>();

  private constructor() {
    // this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    this.baseUrl = '/api/v1';
    // 确保 baseUrl 以 / 结尾
    if (!this.baseUrl.endsWith('/')) {
      this.baseUrl += '/';
    }
    console.log('ApiClient initialized with baseUrl:', this.baseUrl);
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private cleanEndpoint(endpoint: string): string {
    // 移除开头的斜杠，避免双斜杠
    return endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  }

  private getCacheKey(endpoint: string, options: RequestInit): string {
    const cleanEndpoint = this.cleanEndpoint(endpoint);
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    return `${method}:${cleanEndpoint}:${body}`;
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey(endpoint, options);
    
    // 检查是否有正在进行的相同请求
    if (ApiClient.requestCache.has(cacheKey)) {
      console.log('Reusing existing request:', cacheKey);
      return ApiClient.requestCache.get(cacheKey) as Promise<ApiResponse<T>>;
    }

    const url = `${this.baseUrl}${this.cleanEndpoint(endpoint)}`;
    console.log('Making API request:', {
      url,
      method: options.method || 'GET',
      endpoint
    });

    // 创建新的请求
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
          },
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          return {
            status: 'error' as const,
            message: errorData?.message || `请求失败: ${response.status}`,
            data: null as any
          };
        }

        // 检查响应类型
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          console.log('Response data:', data);
          return {
            status: 'success' as const,
            data: data.data || data
          };
        } else {
          // 对于非 JSON 响应（如二进制数据），直接返回
          const data = await response.arrayBuffer();
          return {
            status: 'success' as const,
            data: data as any
          };
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request was aborted');
          return {
            status: 'error' as const,
            message: 'Request was aborted',
            data: null as any
          };
        }
        return {
          status: 'error' as const,
          message: error instanceof Error ? error.message : '请求失败',
          data: null as any
        };
      } finally {
        // 请求完成后从缓存中移除
        ApiClient.requestCache.delete(cacheKey);
      }
    })();

    // 将请求保存到缓存中
    ApiClient.requestCache.set(cacheKey, requestPromise);
    return requestPromise;
  }

  async get<T>(endpoint: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: options?.signal,
    });
  }

  async post<T>(endpoint: string, data: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    const isFormData = data instanceof FormData;
    const headers: Record<string, string> = {};
    
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data),
      signal: options?.signal,
    });
  }
}

// 临时模拟数据
const mockData: Record<string, any> = {}; 