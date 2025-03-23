/**
 * API服务工具函数
 */

/**
 * 同步本地存储内容到Redis
 * 异步操作，不等待完成
 */
export async function syncRedisWithLocalStorage(): Promise<void> {
  try {
    // 调用Redis同步API
    const response = await fetch('/api/ai-config/sync-redis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`同步Redis失败 (${response.status}):`, errorText);
      throw new Error('同步Redis失败: ' + errorText);
    }
  } catch (error: unknown) {
    console.error('同步Redis失败:', error);
    throw error;
  }
}

/**
 * 处理API响应
 * 确保正确解析JSON并处理错误
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `请求失败: ${response.status} ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // 如果无法解析JSON，使用默认错误消息
    }
    
    throw new Error(errorMessage);
  }
  
  try {
    return await response.json() as T;
  } catch (error) {
    console.error('解析API响应失败:', error);
    throw new Error('解析API响应失败');
  }
} 