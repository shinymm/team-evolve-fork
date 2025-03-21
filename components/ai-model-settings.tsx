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
import { useAIConfigStore } from '@/lib/stores/ai-config-store'
import type { AIModelConfig } from '@/lib/services/ai-service'
import { streamingAICall } from '@/lib/services/ai-service'

// 可用的AI模型预设
const modelPresets = [
  {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4o','gpt-4o-mini','gpt-3.5-turbo']
  },
  {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v3',
    models: ['glm-4-long', 'glm-4-flash', 'glm-4-plus', 'GLM-Zero-Preview']
  },
  {
    name: 'Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-long']
  },
  {
    name: 'Deepseek',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-chat']
  },
  {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash-lite','gemini-2.0-flash-thinking-exp-01-21']
  }
]

export function AIModelSettings() {
  // 使用 Zustand store 获取配置
  const { configs, addConfig, updateConfig, deleteConfig, setDefaultConfig } = useAIConfigStore()
  
  // UI状态
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [selectedTab, setSelectedTab] = useState('models')

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    const [provider, ...modelParts] = preset.split('-');
    const model = modelParts.join('-'); // 重新组合模型名称，保留所有部分
    
    let baseURL = '';
    
    const providerData = modelPresets.find(p => p.name === provider);
    if (providerData) {
      baseURL = providerData.baseURL;
    }
    
    setNewConfig({
      ...newConfig,
      name: preset, // 使用完整的预设名称
      model, // 使用完整的模型名称
      baseURL
    });
  }, [newConfig])

  // 添加新配置
  const handleAddConfig = useCallback(() => {
    if (!newConfig.name || !newConfig.baseURL || !newConfig.apiKey) {
      toast({
        title: '验证失败',
        description: 'API地址、模型名称和API Key是必填项',
        variant: 'destructive',
      })
      return
    }

    // 为新配置生成唯一ID
    const id = Date.now().toString()
    
    // 如果是第一个配置，自动设为默认
    const isFirstConfig = configs.length === 0
    
    const configToAdd: AIModelConfig = {
      id,
      name: newConfig.name || '',
      baseURL: newConfig.baseURL || '',
      apiKey: newConfig.apiKey || '',
      temperature: newConfig.temperature || 0.7,
      model: newConfig.model || '',
      isDefault: isFirstConfig // 第一个配置默认设为默认配置
    }
    
    // 添加到 store
    addConfig(configToAdd)
    
    // 重置表单
    setNewConfig({})
    setShowAddForm(false)
    
    toast({
      title: '添加成功',
      description: '新的AI模型配置已添加',
    })
  }, [configs.length, newConfig, addConfig])

  // 删除配置
  const handleDeleteConfig = useCallback((id: string) => {
    // 从 store 删除配置
    deleteConfig(id)
    
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
  }, [deleteConfig])

  // 设置默认配置
  const handleSetDefault = useCallback((id: string) => {
    // 更新 store 中的默认配置
    setDefaultConfig(id)
    
    toast({
      title: '已更新默认配置',
      description: 'AI模型默认配置已更新',
    })
  }, [setDefaultConfig])

  // 测试连接
  const handleTestConfig = useCallback(async (config: AIModelConfig) => {
    if (!config.id) return;
    
    setTestingId(config.id)
    
    try {
      // 使用统一的 AI 接口进行测试
      let responseContent = '';
      await new Promise<void>((resolve, reject) => {
        streamingAICall(
          "测试连接,请简洁回复", // 最简单的测试提示词
          config, // 使用当前配置
          (content) => {
            responseContent += content;
            // 收到任何响应就表示连接成功
            resolve();
          },
          
        ).catch(reject);
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [config.id as string]: true 
      }))
      toast({
        title: '测试成功',
        description: `成功连接到${config.name}\n模型返回：${responseContent}`,
      })
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
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
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

