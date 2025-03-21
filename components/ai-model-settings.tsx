'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Zap } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'
import VectorSettings from '@/components/vector-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AIModelConfig } from '@/lib/services/ai-service'
import { streamingAICall } from '@/lib/services/ai-service'
import { addAIConfig, updateAIConfig, deleteAIConfig, setDefaultAIConfig, getAllAIConfigs } from '@/lib/services/ai-config-service'

// 可用的AI模型预设
const modelPresets = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4o','gpt-4o-mini','gpt-3.5-turbo']
  },
  {
    name: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v3',
    models: ['glm-4-long', 'glm-4-flash', 'glm-4-plus', 'GLM-Zero-Preview']
  },
  {
    name: 'Qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-long']
  },
  {
    name: 'Deepseek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat']
  },
  {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-lite','gemini-2.0-flash-thinking-exp-01-21']
  }
]

export function AIModelSettings() {
  const [configs, setConfigs] = useState<AIModelConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [selectedTab, setSelectedTab] = useState('models')
  const [isLoading, setIsLoading] = useState(true)

  // 加载配置
  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true)
      const loadedConfigs = await getAllAIConfigs()
      setConfigs(loadedConfigs)
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '加载配置时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    const [provider, ...modelParts] = preset.split('-');
    const model = modelParts.join('-'); // 重新组合模型名称，保留所有部分
    
    let baseUrl = '';
    
    const providerData = modelPresets.find(p => p.name === provider);
    if (providerData) {
      baseUrl = providerData.baseUrl;
    }
    
    setNewConfig({
      ...newConfig,
      name: preset, // 使用完整的预设名称
      model, // 使用完整的模型名称
      baseUrl
    });
  }, [newConfig])

  // 添加新配置
  const handleAddConfig = useCallback(async () => {
    if (!newConfig.name || !newConfig.baseUrl || !newConfig.apiKey) {
      toast({
        title: '验证失败',
        description: 'API地址、模型名称和API Key是必填项',
        variant: 'destructive',
      })
      return
    }

    try {
      // 为新配置生成唯一ID
      const id = Date.now().toString()
      
      // 如果是第一个配置，自动设为默认
      const isFirstConfig = configs.length === 0
      
      const configToAdd: AIModelConfig = {
        id,
        name: newConfig.name || '',
        baseUrl: newConfig.baseUrl || '',
        apiKey: newConfig.apiKey || '',
        temperature: newConfig.temperature || 0.7,
        model: newConfig.model || '',
        isDefault: isFirstConfig
      }
      
      // 添加配置
      await addAIConfig(configToAdd)
      
      // 重新加载配置列表
      await loadConfigs()
      
      // 重置表单
      setNewConfig({})
      setShowAddForm(false)
      
      toast({
        title: '添加成功',
        description: '新的AI模型配置已添加',
      })
    } catch (error) {
      toast({
        title: '添加失败',
        description: error instanceof Error ? error.message : '添加配置时发生错误',
        variant: 'destructive',
      })
    }
  }, [configs.length, newConfig, loadConfigs])

  // 删除配置
  const handleDeleteConfig = useCallback(async (id: string) => {
    try {
      await deleteAIConfig(id)
      await loadConfigs()
      
      // 清除该配置的测试结果
      setTestResults(prev => {
        const newResults = { ...prev }
        delete newResults[id]
        return newResults
      })
      
      toast({
        title: '删除成功',
        description: 'AI模型配置已删除',
      })
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除配置时发生错误',
        variant: 'destructive',
      })
    }
  }, [loadConfigs])

  // 设置默认配置
  const handleSetDefault = useCallback(async (id: string) => {
    try {
      await setDefaultAIConfig(id)
      await loadConfigs()
      
      toast({
        title: '已更新默认配置',
        description: 'AI模型默认配置已更新',
      })
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '设置默认配置时发生错误',
        variant: 'destructive',
      })
    }
  }, [loadConfigs])

  // 测试连接
  const handleTestConfig = useCallback(async (config: AIModelConfig) => {
    if (!config.id) return;
    
    setTestingId(config.id)
    setTestResults(prev => ({ ...prev, [config.id as string]: null }))
    
    try {
      // 使用统一的 AI 接口进行测试
      let responseContent = '';
      await streamingAICall(
        "测试连接,请简洁回复", // 最简单的测试提示词
        config, // 使用当前配置
        (content) => {
          responseContent += content;
          // 收到任何响应就表示连接成功
          setTestResults(prev => ({ ...prev, [config.id as string]: true }))
        },
        (error) => {
          console.error('测试连接失败:', error)
          setTestResults(prev => ({ ...prev, [config.id as string]: false }))
          toast({
            title: '测试失败',
            description: error,
            variant: 'destructive',
          })
        }
      )
      
      if (responseContent) {
        toast({
          title: '测试成功',
          description: `成功连接到${config.name}\n模型返回：${responseContent}`,
        })
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [config.id as string]: false 
      }))
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '无法连接到AI服务',
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
          <TableCell>{config.model || '-'}</TableCell>
          <TableCell>{config.baseUrl}</TableCell>
          <TableCell>{config.temperature || '0.2'}</TableCell>
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
            <Label htmlFor="ai-preset">预设模型</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="ai-preset">
                <SelectValue placeholder="选择预设" />
              </SelectTrigger>
              <SelectContent>
                {modelPresets.map(provider => (
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
            <Label htmlFor="ai-name">名称</Label>
            <Input
              id="ai-name"
              value={newConfig.name || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如: OpenAI GPT-4"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="ai-model">模型名称</Label>
            <Input
              id="ai-model"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder="例如: gpt-4-turbo, text-embedding-3-small"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="ai-url">API 地址</Label>
            <Input
              id="ai-url"
              value={newConfig.baseUrl || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="例如: https://api.openai.com/v1"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="输入您的API密钥"
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="ai-temperature">温度</Label>
            <Input
              id="ai-temperature"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={newConfig.temperature || 0.2}
              onChange={(e) => setNewConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              placeholder="输入温度值（0-1之间）"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              取消
            </Button>
            <Button onClick={handleAddConfig}>
              添加
            </Button>
          </div>
        </div>
      </div>
    )
  }, [showAddForm, newConfig, handlePresetChange, handleAddConfig])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="models" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="models">AI模型设置</TabsTrigger>
          <TabsTrigger value="vector">向量模型设置</TabsTrigger>
        </TabsList>
        
        <TabsContent value="models" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI模型配置</CardTitle>
              <CardDescription>
                配置用于AI助手和问答的大语言模型
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
                        <TableHead>温度</TableHead>
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
                    暂无AI模型配置，请点击"添加配置"按钮添加
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="vector" className="pt-4">
          <VectorSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// 导出为默认组件，以便与 React.lazy 配合使用
export default AIModelSettings

