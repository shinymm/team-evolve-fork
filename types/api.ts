export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  message?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  total: number;
  page: number;
  pageSize: number;
} 