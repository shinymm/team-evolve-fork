'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type AIModelConfig } from '@/lib/services/ai-service';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

// 用于 SWR 的 fetcher 函数
const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache,no-store,must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // 添加随机参数避免缓存
      'x-timestamp': Date.now().toString()
    }
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    const error = await res.json();
    throw new Error(error.error || '获取Redis配置失败');
  }
  
  return res.json();
};

export default function RedisConfigStatus() {
  const [isSyncing, setIsSyncing] = useState(false);
  
  // 使用 SWR 获取数据
  const { data: redisConfig, error, isLoading, mutate: refreshData } = useSWR(
    '/api/ai-config/redis/default',
    fetcher,
    {
      refreshInterval: 600000, // 每10分钟自动刷新 (10 * 60 * 1000 ms)
      revalidateOnFocus: true, // 窗口获得焦点时重新验证
      dedupingInterval: 1000, // 1秒内的重复请求会被去重
    }
  );

  // 同步到Redis
  const syncToRedis = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      // 获取所有配置
      const response = await fetch('/api/ai-config');
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      const configs = await response.json();
      
      // 如果数据库中没有配置，则清空Redis
      if (!configs || configs.length === 0) {
        const clearResponse = await fetch('/api/ai-config/redis', {
          method: 'DELETE',
        });
        
        if (!clearResponse.ok) {
          throw new Error('清除Redis配置失败');
        }
        
        // 强制重新获取数据
        await mutate('/api/ai-config/redis/default');
        toast.success('Redis配置已清空');
        return;
      }
      
      // 同步到Redis
      const syncResponse = await fetch('/api/ai-config/sync-redis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      });
      
      if (!syncResponse.ok) {
        const errorData = await syncResponse.json();
        throw new Error(errorData.error || '同步到Redis失败');
      }
      
      // 强制重新获取数据
      await mutate('/api/ai-config/redis/default');
      
      toast.success('配置已成功同步到Redis');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      toast.error(`同步失败: ${errorMessage}`);
      console.error('同步到Redis失败:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 手动刷新
  const handleRefresh = async () => {
    try {
      await refreshData();
      toast.success('已刷新Redis配置');
    } catch (err) {
      toast.error('刷新失败');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Redis缓存状态</CardTitle>
        <CardDescription>
          查看当前Redis中缓存的默认AI模型配置
          {redisConfig?.updatedAt && (
            <div className="text-xs text-muted-foreground mt-1">
              最后更新: {new Date(redisConfig.updatedAt).toLocaleString()}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>{error.message || 'Redis连接错误'}</span>
            </div>
          </div>
        ) : redisConfig ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Redis缓存已启用</span>
            </div>
            
            <div className="grid gap-2">
              <Label>默认配置</Label>
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium">{redisConfig.name}</p>
                <p className="text-xs text-muted-foreground">模型: {redisConfig.model}</p>
                <p className="text-xs text-muted-foreground">baseURL: {redisConfig.baseURL}</p>
                <p className="text-xs text-muted-foreground">ID: {redisConfig.id}</p>
                {redisConfig.updatedAt && (
                  <p className="text-xs text-muted-foreground">
                    更新时间: {new Date(redisConfig.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>Redis中无默认配置</span>
            </div>
          </div>
        )}
        
        <div className="mt-4 flex space-x-2">
          <Button 
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            刷新
          </Button>
          
          <Button 
            onClick={syncToRedis}
            variant="default"
            size="sm"
            disabled={isLoading || isSyncing}
          >
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            同步到Redis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 