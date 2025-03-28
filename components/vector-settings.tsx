'use client'

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Zap, AlertCircle } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useVectorConfigStore } from '@/lib/stores/vector-config-store'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { VectorModelConfig, addVectorConfig, deleteVectorConfig, getAllVectorConfigs, setVectorConfig } from '@/lib/services/vector-config-service'

// 可用的向量模型预设
const vectorModelPresets = [
  {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: [
      'text-embedding-3-small',   // 更小、更快、更便宜
      'text-embedding-3-large',   // 最强性能
      'text-embedding-ada-002'    // 旧版本，向后兼容
    ],
    dimensions: {  // 不同模型的维度
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072, 
      'text-embedding-ada-002': 1536
    } as Record<string, number>
  },
  {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      'embedding-2',     // 通用文本向量
      'embedding-2-1',   // 增强版文本向量
      'embedding-3'      // 最新版本
    ],
    dimensions: {  // 不同模型的维度
      'embedding-2': 1024,
      'embedding-2-1': 1024,
      'embedding-3': 1536
    } as Record<string, number>
  }
]

export default function VectorSettings() {
  // 使用 Zustand store 获取配置
  const { defaultConfig, setDefaultConfig, clearDefaultConfig } = useVectorConfigStore()
  
  // 本地状态
  const [configs, setConfigs] = useState<VectorModelConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<VectorModelConfig>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [isDefault, setIsDefault] = useState(false)

  // 加载所有配置
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const allConfigs = await getAllVectorConfigs()
        setConfigs(allConfigs)
      } catch (error) {
        console.error('加载配置失败:', error)
        toast({
          title: '加载失败',
          description: '无法加载向量模型配置',
          variant: 'destructive',
        })
      }
    }
    loadConfigs()
  }, [])

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    // 找到第一个连字符的位置
    const firstHyphenIndex = preset.indexOf('-');
    
    // 提取提供商名称和模型名称
    const provider = preset.slice(0, firstHyphenIndex);
    const model = preset.slice(firstHyphenIndex + 1);
    
    let baseURL = '';
    
    const providerData = vectorModelPresets.find(p => p.name === provider);
    if (providerData) {
      baseURL = providerData.baseURL;
    }
    
    setNewConfig({
      ...newConfig,
      name: `${provider}-${model}`,
      model,
      baseURL
    });
  }, [newConfig])

  // 添加新配置
  const handleAddConfig = useCallback(async () => {
    if (!newConfig.name || !newConfig.baseURL || !newConfig.apiKey || !newConfig.model) {
      toast({
        title: '验证失败',
        description: 'API地址、模型名称、API Key和向量模型名称是必填项',
        variant: 'destructive',
      })
      return
    }

    // 为新配置生成唯一ID
    const id = Date.now().toString()
    
    // 确定模型维度
    let dimension = 1536; // 默认维度
    
    // 从预设中查找维度
    const [provider] = newConfig.name?.split('-') || [];
    const modelName = newConfig.model || '';
    const presetProvider = vectorModelPresets.find(p => p.name === provider);
    
    if (presetProvider?.dimensions && modelName in presetProvider.dimensions) {
      dimension = presetProvider.dimensions[modelName as keyof typeof presetProvider.dimensions];
    }
    
    const configToAdd: VectorModelConfig = {
      id,
      name: newConfig.name,
      baseURL: newConfig.baseURL.trim(),
      apiKey: newConfig.apiKey.trim(),
      model: newConfig.model.trim(),
      isDefault: isDefault,
      dimension,
      provider
    }
    
    try {
      // 添加到数据库
      const savedConfig = await addVectorConfig(configToAdd)
      
      // 如果是默认配置，更新store（使用返回的加密配置）
      if (isDefault) {
        await setVectorConfig(savedConfig)
        setDefaultConfig(savedConfig)
      }
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      // 重置表单
      setNewConfig({})
      setIsDefault(false)
      setShowAddForm(false)
      
      toast({
        title: '添加成功',
        description: '新的向量模型配置已添加',
      })
    } catch (error) {
      console.error('添加配置失败:', error)
      toast({
        title: '添加失败',
        description: '无法添加向量模型配置',
        variant: 'destructive',
      })
    }
  }, [newConfig, isDefault, setDefaultConfig])

  // 删除配置
  const handleDeleteConfig = useCallback(async (id: string) => {
    if (!confirm('确定要删除这个配置吗？')) return
    
    try {
      const configToDelete = configs.find(c => c.id === id)
      await deleteVectorConfig(id)
      
      // 如果删除的是默认配置
      if (configToDelete?.isDefault) {
        // 获取剩余配置中最新的一个
        const remainingConfigs = configs.filter(c => c.id !== id)
        if (remainingConfigs.length > 0) {
          const newDefault = remainingConfigs[remainingConfigs.length - 1]
          await setVectorConfig(newDefault)
          setDefaultConfig(newDefault)
        } else {
          clearDefaultConfig()
        }
      }
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      // 清除该配置的测试结果
      setTestResults((prev) => {
        const newResults = { ...prev }
        delete newResults[id]
        return newResults
      })
      
      toast({
        title: '删除成功',
        description: '向量模型配置已删除',
      })
    } catch (error) {
      console.error('删除配置失败:', error)
      toast({
        title: '删除失败',
        description: '无法删除向量模型配置',
        variant: 'destructive',
      })
    }
  }, [configs, setDefaultConfig, clearDefaultConfig])

  // 设置默认配置
  const handleSetDefault = useCallback(async (id: string) => {
    try {
      const configToSetDefault = configs.find(c => c.id === id)
      if (!configToSetDefault) return
      
      await setVectorConfig(configToSetDefault)
      setDefaultConfig(configToSetDefault)
      
      // 重新加载配置列表
      const allConfigs = await getAllVectorConfigs()
      setConfigs(allConfigs)
      
      toast({
        title: '已更新默认配置',
        description: '向量模型默认配置已更新',
      })
    } catch (error) {
      console.error('设置默认配置失败:', error)
      toast({
        title: '设置失败',
        description: '无法设置默认向量模型配置',
        variant: 'destructive',
      })
    }
  }, [configs, setDefaultConfig])

  // 测试连接
  const handleTestConfig = useCallback(async (config: VectorModelConfig) => {
    if (!config.id) return;
    
    setTestingId(config.id)
    
    try {
      const response = await fetch('/api/vector-config/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseURL: config.baseURL,
          apiKey: config.apiKey,
          model: config.model
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      
      setTestResults((prev: Record<string, boolean>) => ({ 
        ...prev, 
        [config.id as string]: true 
      }))
      toast({
        title: '测试成功',
        description: `成功连接到${config.name}\n测试文本：${data.data.testText}\n向量维度：${data.data.dimensions}\n示例向量：${data.data.embedding.join(', ')}`,
      })
    } catch (error) {
      setTestResults((prev: Record<string, boolean>) => ({ 
        ...prev, 
        [config.id as string]: false 
      }))
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '无法连接到向量服务',
        variant: 'destructive',
      })
    } finally {
      setTestingId(null)
    }
  }, [])

  // 使用 useMemo 缓存配置列表渲染
  const configRows = useMemo(() => {
    return configs.map((config) => {
      // 确保配置有id
      if (!config.id) return null;
      
      return (
        <TableRow key={config.id}>
          <TableCell className="font-medium">{config.name}</TableCell>
          <TableCell>{config.model}</TableCell>
          <TableCell>{config.baseURL}</TableCell>
          <TableCell className="text-center">
            <div
              className={cn(
                "h-4 w-4 rounded-full border border-primary cursor-pointer",
                config.isDefault && "bg-primary"
              )}
              onClick={() => handleSetDefault(config.id as string)}
            />
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConfig(config)}
                disabled={testingId === config.id}
                className={cn(
                  testResults[config.id] === true && "bg-green-50 text-green-600 hover:bg-green-100",
                  testResults[config.id] === false && "bg-red-50 text-red-600 hover:bg-red-100"
                )}
              >
                {testingId === config.id ? (
                  <>
                    <Zap className="mr-2 h-4 w-4 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    测试连接
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteConfig(config.id as string)}
                disabled={testingId === config.id}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }).filter(Boolean)
  }, [configs, testingId, testResults, handleTestConfig, handleDeleteConfig, handleSetDefault])

  // 使用 useMemo 缓存添加表单渲染
  const addForm = useMemo(() => {
    if (!showAddForm) return null
    
    return (
      <div className="space-y-4 border p-4 rounded-md bg-slate-50">
        <h2 className="text-lg font-semibold">添加新配置</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-preset">预设模型</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="vector-preset">
                <SelectValue placeholder="选择预设" />
              </SelectTrigger>
              <SelectContent>
                {vectorModelPresets.map(provider => (
                  <React.Fragment key={provider.name}>
                    {provider.models.map(model => (
                      <SelectItem key={`${provider.name}-${model}`} value={`${provider.name}-${model}`}>
                        {provider.name} - {model}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-name">名称</Label>
            <Input
              id="vector-name"
              value={newConfig.name || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如: OpenAI Embedding"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-model">模型名称</Label>
            <Input
              id="vector-model"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder="例如: text-embedding-3-small"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-url">API 地址</Label>
            <Input
              id="vector-url"
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
              placeholder="例如: https://api.openai.com/v1"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-api-key">API Key</Label>
            <Input
              id="vector-api-key"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="输入您的API密钥"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="vector-default">设为默认</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vector-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              />
              <Label htmlFor="vector-default">将此配置设为默认向量模型</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setShowAddForm(false)
              setIsDefault(false)
              setNewConfig({})
            }}>
              取消
            </Button>
            <Button onClick={handleAddConfig}>
              添加
            </Button>
          </div>
        </div>
      </div>
    )
  }, [showAddForm, newConfig, handlePresetChange, handleAddConfig, isDefault])

  return (
    <Card>
      <CardHeader>
        <CardTitle>向量模型配置</CardTitle>
        <CardDescription>
          配置用于生成文本向量的嵌入模型
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!showAddForm && (
            <div className="flex justify-end items-center mb-4">
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加配置
              </Button>
            </div>
          )}
          
          {addForm}
          
          {configs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead>API地址</TableHead>
                  <TableHead>默认</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configRows}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无向量模型配置，请点击"添加配置"按钮添加
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 