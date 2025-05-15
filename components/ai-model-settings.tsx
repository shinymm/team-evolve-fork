'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Zap, Loader2 } from 'lucide-react'
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from '@/lib/utils'
import VectorSettings from '@/components/vector-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AIModelConfig } from '@/lib/services/ai-service'
import { streamingAICall } from '@/lib/services/ai-service'
import { 
  addAIConfig, 
  deleteAIConfig, 
  setDefaultAIConfig, 
  getAllAIConfigs,
  getAIConfigsByType 
} from '@/lib/services/ai-config-service'

// 可用的AI模型预设
const modelPresets = [
  {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4o','gpt-4o-mini','gpt-3.5-turbo']
  },
  {
    name: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-long', 'glm-4-flash']
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

// 可用的视觉模型预设
const visionModelPresets = [
  {
    name: 'Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-vl', 'qwen-vl-max', 'qvq-max']
  }
]

export function AIModelSettings({ onStatusChange }: { onStatusChange?: (loading: boolean) => void }) {
  const [languageConfigs, setLanguageConfigs] = useState<AIModelConfig[]>([])
  const [visionConfigs, setVisionConfigs] = useState<AIModelConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({})
  const [currentModelType, setCurrentModelType] = useState<'language' | 'vision'>('language')
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [selectedTab, setSelectedTab] = useState('models')
  const [isLoading, setIsLoading] = useState(false)
  
  // 更新父组件的加载状态
  useEffect(() => {
    onStatusChange?.(isLoading)
  }, [isLoading, onStatusChange])
  
  // 加载不同类型的配置
  const loadConfigsByType = useCallback(async (type: 'language' | 'vision') => {
    try {
      setIsLoading(true)
      const loadedConfigs = await getAIConfigsByType(type)
      
      if (type === 'language') {
        setLanguageConfigs(loadedConfigs)
      } else {
        setVisionConfigs(loadedConfigs)
      }
    } catch (error) {
      toast({
        title: `加载${type === 'language' ? '语言' : '视觉'}模型配置失败`,
        description: error instanceof Error ? error.message : '加载配置时发生错误',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 加载所有配置
  const loadAllConfigs = useCallback(async () => {
    await loadConfigsByType('language')
    await loadConfigsByType('vision')
  }, [loadConfigsByType])

  // 初始加载
  useEffect(() => {
    loadAllConfigs()
  }, [loadAllConfigs])

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    const [provider, ...modelParts] = preset.split('-')
    const model = modelParts.join('-')
    
    let baseURL = ''
    // 根据当前模型类型选择不同的预设列表
    const presetList = currentModelType === 'language' ? modelPresets : visionModelPresets
    const providerData = presetList.find(p => p.name === provider)
    if (providerData) {
      baseURL = providerData.baseURL
    }
    
    setNewConfig({
      ...newConfig,
      name: preset,
      model,
      baseURL,
      type: currentModelType
    })
  }, [newConfig, currentModelType])

  // 添加新配置
  const handleAddConfig = useCallback(async () => {
    if (!newConfig.name || !newConfig.baseURL || !newConfig.apiKey || !newConfig.model) {
      toast({
        title: '验证失败',
        description: 'API地址、模型名称、模型类型和API Key是必填项',
        variant: 'destructive',
      })
      return
    }

    try {
      const configToAdd = {
        name: newConfig.name,
        baseURL: newConfig.baseURL,
        apiKey: newConfig.apiKey,
        model: newConfig.model,
        temperature: newConfig.temperature || 0.7,
        type: newConfig.type || 'language' // 确保设置类型
      }
      
      await addAIConfig(configToAdd)
      
      // 根据类型刷新对应的配置列表
      if (configToAdd.type === 'vision') {
        await loadConfigsByType('vision')
      } else {
        await loadConfigsByType('language')
      }
      
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
  }, [newConfig, loadConfigsByType])

  // 删除配置
  const handleDeleteConfig = useCallback(async (id: string, type: string = 'language') => {
    try {
      await deleteAIConfig(id)
      
      // 根据类型刷新对应的配置列表
      if (type === 'vision') {
        await loadConfigsByType('vision')
      } else {
        await loadConfigsByType('language')
      }
      
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
  }, [loadConfigsByType])

  // 设置默认配置
  const handleSetDefault = useCallback(async (id: string, type: string = 'language') => {
    setIsLoading(true)
    
    try {
      await setDefaultAIConfig(id)
      
      // 根据类型刷新对应的配置列表
      if (type === 'vision') {
        await loadConfigsByType('vision')
      } else {
        await loadConfigsByType('language')
      }
      
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
    } finally {
      setIsLoading(false)
    }
  }, [loadConfigsByType])

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

  // 生成配置表格行
  const generateConfigRows = useCallback((configs: AIModelConfig[], type: string = 'language') => {
    // 确保列表始终按名称排序
    const sortedConfigs = [...configs].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    )
    
    return sortedConfigs.map((config) => {
      // 确保配置有id
      if (!config.id) return null;
      
      return (
        <TableRow key={config.id}>
          <TableCell className="py-2 text-sm">{config.name}</TableCell>
          <TableCell className="py-2 text-sm">{config.model || '-'}</TableCell>
          <TableCell className="py-2 text-sm">{config.baseURL}</TableCell>
          <TableCell className="py-2 text-sm">{config.temperature || '0.2'}</TableCell>
          <TableCell className="py-2 text-center">
            <div
              className={cn(
                "h-3 w-3 rounded-full border border-primary cursor-pointer",
                config.isDefault && "bg-primary"
              )}
              onClick={() => handleSetDefault(config.id as string, type)}
            />
          </TableCell>
          <TableCell className="py-2">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConfig(config)}
                disabled={testingId === config.id}
                className={cn(
                  "h-7 text-xs",
                  testResults[config.id] === true && "bg-green-50 text-green-600 hover:bg-green-100",
                  testResults[config.id] === false && "bg-red-50 text-red-600 hover:bg-red-100"
                )}
              >
                {testingId === config.id ? (
                  <>
                    <Zap className="mr-1 h-3 w-3 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <Zap className="mr-1 h-3 w-3" />
                    测试连接
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteConfig(config.id as string, type)}
                disabled={testingId === config.id}
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }).filter(Boolean)
  }, [testingId, testResults, handleTestConfig, handleDeleteConfig, handleSetDefault])

  // 生成语言模型的配置行
  const languageConfigRows = useMemo(() => {
    return generateConfigRows(languageConfigs, 'language')
  }, [languageConfigs, generateConfigRows])

  // 生成视觉模型的配置行
  const visionConfigRows = useMemo(() => {
    return generateConfigRows(visionConfigs, 'vision')
  }, [visionConfigs, generateConfigRows])

  // 使用 useMemo 缓存添加表单渲染
  const addForm = useMemo(() => {
    if (!showAddForm) return null
    
    // 选择当前模型类型对应的预设列表
    const presetList = currentModelType === 'language' ? modelPresets : visionModelPresets
    
    return (
      <div className="space-y-3 border p-3 rounded-md bg-slate-50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold">添加新配置</h2>
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant={currentModelType === 'language' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setCurrentModelType('language')}
            >
              语言模型
            </Button>
            <Button 
              size="sm" 
              variant={currentModelType === 'vision' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setCurrentModelType('vision')}
            >
              视觉模型
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-preset" className="text-xs">预设模型</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="ai-preset" className="h-8 text-sm">
                <SelectValue placeholder="选择预设" />
              </SelectTrigger>
              <SelectContent>
                {presetList.map(provider => (
                  <React.Fragment key={provider.name}>
                    {provider.models.map(model => (
                      <SelectItem key={`${provider.name}-${model}`} value={`${provider.name}-${model}`} className="text-sm">
                        {provider.name} - {model}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-name" className="text-xs">名称</Label>
            <Input
              id="ai-name"
              value={newConfig.name || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如: OpenAI GPT-4"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-model" className="text-xs">模型名称</Label>
            <Input
              id="ai-model"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder="例如: gpt-4-turbo, text-embedding-3-small"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-url" className="text-xs">API 地址</Label>
            <Input
              id="ai-url"
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
              placeholder="例如: https://api.openai.com/v1"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-api-key" className="text-xs">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="输入您的API密钥"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-temperature" className="text-xs">温度</Label>
            <Input
              id="ai-temperature"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={newConfig.temperature || 0.7}
              onChange={(e) => setNewConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              placeholder="输入温度值（0-1之间）"
              className="h-8 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleAddConfig}>
              添加
            </Button>
          </div>
        </div>
      </div>
    )
  }, [showAddForm, newConfig, currentModelType, handlePresetChange, handleAddConfig])

  return (
    <Tabs
      value={selectedTab}
      onValueChange={setSelectedTab}
      className="w-full"
    >
      <TabsList className="mb-6">
        <TabsTrigger value="models">AI模型设置</TabsTrigger>
        <TabsTrigger value="vector">向量模型设置</TabsTrigger>
      </TabsList>
      
      <TabsContent value="models">
        <Card className="w-full">
          <CardHeader className="pb-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold mb-3">AI模型配置</CardTitle>
                <CardDescription className="text-base">
                  配置不同的AI模型服务，用于问答和聊天功能
                </CardDescription>
              </div>
              {!showAddForm && (
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加配置
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-8">
              {addForm}
              
              {/* 语言模型配置表格 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">语言模型</h3>
                {languageConfigs.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-xs">名称</TableHead>
                          <TableHead className="h-8 text-xs">模型</TableHead>
                          <TableHead className="h-8 text-xs">API地址</TableHead>
                          <TableHead className="h-8 text-xs">温度</TableHead>
                          <TableHead className="h-8 text-xs">默认</TableHead>
                          <TableHead className="h-8 text-xs">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {languageConfigRows}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    暂无语言模型配置，请添加新的配置
                  </div>
                )}
              </div>
              
              {/* 视觉模型配置表格 */}
              <div className="space-y-4 mt-8">
                <h3 className="text-lg font-semibold">视觉模型</h3>
                {visionConfigs.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-xs">名称</TableHead>
                          <TableHead className="h-8 text-xs">模型</TableHead>
                          <TableHead className="h-8 text-xs">API地址</TableHead>
                          <TableHead className="h-8 text-xs">温度</TableHead>
                          <TableHead className="h-8 text-xs">默认</TableHead>
                          <TableHead className="h-8 text-xs">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visionConfigRows}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    暂无视觉模型配置，请添加新的配置
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="vector">
        <VectorSettings onStatusChange={onStatusChange} />
      </TabsContent>
    </Tabs>
  )
}

// 导出为默认组件，以便与 React.lazy 配合使用
export default AIModelSettings

