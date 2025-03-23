'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type AIModelConfig } from '@/lib/services/ai-service';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function RedisConfigStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [redisConfig, setRedisConfig] = useState<AIModelConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 从Redis加载默认配置
  const loadConfigFromRedis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai-config/redis/default');
      
      if (!response.ok) {
        if (response.status === 404) {
          setRedisConfig(null);
          setError('Redis中未找到默认配置');
        } else {
          const data = await response.json();
          throw new Error(data.error || '获取Redis配置失败');
        }
      } else {
        const config = await response.json();
        setRedisConfig(config);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      console.error('加载Redis配置失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 同步所有配置到Redis
  const syncToRedis = async () => {
    try {
      const response = await fetch('/api/ai-config');
      
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      
      const configs = await response.json();
      
      // 使用新的fetch请求将配置同步到Redis
      const syncResponse = await fetch('/api/ai-config/sync-redis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs }),
      });
      
      if (!syncResponse.ok) {
        throw new Error('同步到Redis失败');
      }
      
      toast.success('配置已成功同步到Redis');
      
      // 重新加载Redis配置
      await loadConfigFromRedis();
    } catch (err) {
      toast.error('同步失败: ' + (err instanceof Error ? err.message : '未知错误'));
      console.error('同步到Redis失败:', err);
    }
  };

  // 组件挂载时加载Redis配置
  useEffect(() => {
    loadConfigFromRedis();
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Redis缓存状态</CardTitle>
        <CardDescription>
          查看当前Redis中缓存的默认AI模型配置
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>{error || 'Redis中无默认配置'}</span>
            </div>
          </div>
        )}
        
        <div className="mt-4 flex space-x-2">
          <Button 
            onClick={loadConfigFromRedis}
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
            disabled={isLoading}
          >
            同步到Redis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 