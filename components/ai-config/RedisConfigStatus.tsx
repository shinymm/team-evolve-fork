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
  const [isSyncing, setIsSyncing] = useState(false);
  const [redisConfig, setRedisConfig] = useState<AIModelConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 从Redis加载默认配置
  const loadConfigFromRedis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 先测试Redis连接
      const testResponse = await fetch('/api/redis-test');
      if (!testResponse.ok) {
        throw new Error('Redis连接测试失败');
      }
      
      // 获取Redis键信息
      const keyCheckResponse = await fetch('/api/redis-key-check');
      const keyCheckData = await keyCheckResponse.json();
      
      if (!keyCheckData.success) {
        throw new Error(keyCheckData.error || 'Redis键检查失败');
      }
      
      // 获取默认配置
      const response = await fetch('/api/ai-config/redis/default');
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Redis中未找到默认配置，键信息:', keyCheckData);
          setRedisConfig(null);
          setError(`Redis中未找到默认配置 (总键数: ${keyCheckData.data.totalKeys})`);
        } else {
          const data = await response.json();
          throw new Error(data.error || '获取Redis配置失败');
        }
      } else {
        const config = await response.json();
        setRedisConfig(config);
        setLastUpdated(new Date());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setError(errorMessage);
      console.error('加载Redis配置失败:', err);
      toast.error(`加载失败: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 同步所有配置到Redis
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
      
      toast.success('配置已成功同步到Redis');
      
      // 等待一小段时间再重新加载，确保Redis更新完成
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadConfigFromRedis();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      toast.error(`同步失败: ${errorMessage}`);
      console.error('同步到Redis失败:', err);
    } finally {
      setIsSyncing(false);
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
          {lastUpdated && (
            <div className="text-xs text-muted-foreground mt-1">
              最后更新: {lastUpdated.toLocaleString()}
            </div>
          )}
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
                <p className="text-xs text-muted-foreground">ID: {redisConfig.id}</p>
                {redisConfig.updatedAt && (
                  <p className="text-xs text-muted-foreground">更新时间: {new Date(redisConfig.updatedAt).toLocaleString()}</p>
                )}
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