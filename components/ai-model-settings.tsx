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
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('AIModelSettings')
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
        title: t('messages.loadFailed', { type: type === 'language' ? '语言' : '视觉' }),
        description: error instanceof Error ? error.message : t('messages.loadFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [t])

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
        title: t('messages.validationFailed'),
        description: t('messages.requiredFields'),
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
        title: t('messages.addSuccess'),
        description: t('messages.addSuccessDetail'),
      })
    } catch (error) {
      toast({
        title: t('messages.addFailed'),
        description: error instanceof Error ? error.message : t('messages.addFailedDetail'),
        variant: 'destructive',
      })
    }
  }, [newConfig, loadConfigsByType, t])

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
        title: t('messages.deleteSuccess'),
        description: t('messages.deleteSuccessDetail'),
      })
    } catch (error) {
      toast({
        title: t('messages.deleteFailed'),
        description: error instanceof Error ? error.message : t('messages.deleteFailedDetail'),
        variant: 'destructive',
      })
    }
  }, [loadConfigsByType, t])

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
        title: t('messages.defaultUpdated'),
        description: t('messages.defaultUpdatedDetail'),
      })
    } catch (error) {
      toast({
        title: t('messages.defaultFailed'),
        description: error instanceof Error ? error.message : t('messages.defaultFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [loadConfigsByType, t])

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
            title: t('messages.testFailed'),
            description: error,
            variant: 'destructive',
          })
        }
      )
      
      if (responseContent) {
        toast({
          title: t('messages.testSuccess'),
          description: t('messages.testSuccessDetail', { 
            name: config.name,
            response: responseContent
          }),
        })
      }
    } catch (error) {
      setTestResults(prev => ({ 
        ...prev, 
        [config.id as string]: false 
      }))
      toast({
        title: t('messages.testFailed'),
        description: error instanceof Error ? error.message : t('messages.testFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setTestingId(null)
    }
  }, [t])

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
                    {t('actions.testing')}
                  </>
                ) : (
                  <>
                    <Zap className="mr-1 h-3 w-3" />
                    {t('actions.testConnection')}
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
  }, [testingId, testResults, handleTestConfig, handleDeleteConfig, handleSetDefault, t])

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
          <h2 className="text-sm font-semibold">{t('addForm.title')}</h2>
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant={currentModelType === 'language' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setCurrentModelType('language')}
            >
              {t('addForm.modelTypes.language')}
            </Button>
            <Button 
              size="sm" 
              variant={currentModelType === 'vision' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setCurrentModelType('vision')}
            >
              {t('addForm.modelTypes.vision')}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-preset" className="text-xs">{t('addForm.fields.preset')}</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="ai-preset" className="h-8 text-sm">
                <SelectValue placeholder={t('addForm.fields.presetPlaceholder')} />
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
            <Label htmlFor="ai-name" className="text-xs">{t('addForm.fields.name')}</Label>
            <Input
              id="ai-name"
              value={newConfig.name || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('addForm.fields.namePlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-model" className="text-xs">{t('addForm.fields.model')}</Label>
            <Input
              id="ai-model"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder={t('addForm.fields.modelPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-url" className="text-xs">{t('addForm.fields.apiUrl')}</Label>
            <Input
              id="ai-url"
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
              placeholder={t('addForm.fields.apiUrlPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-api-key" className="text-xs">{t('addForm.fields.apiKey')}</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder={t('addForm.fields.apiKeyPlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-temperature" className="text-xs">{t('addForm.fields.temperature')}</Label>
            <Input
              id="ai-temperature"
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={newConfig.temperature || 0.7}
              onChange={(e) => setNewConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              placeholder={t('addForm.fields.temperaturePlaceholder')}
              className="h-8 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              {t('addForm.buttons.cancel')}
            </Button>
            <Button size="sm" onClick={handleAddConfig}>
              {t('addForm.buttons.add')}
            </Button>
          </div>
        </div>
      </div>
    )
  }, [showAddForm, newConfig, currentModelType, handlePresetChange, handleAddConfig, t])

  return (
    <Tabs
      value={selectedTab}
      onValueChange={setSelectedTab}
      className="w-full"
    >
      <TabsList className="mb-6">
        <TabsTrigger value="models">{t('tabs.models')}</TabsTrigger>
        <TabsTrigger value="vector">{t('tabs.vector')}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="models">
        <Card className="w-full">
          <CardHeader className="pb-6">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold mb-3">{t('card.title')}</CardTitle>
                <CardDescription className="text-base">
                  {t('card.description')}
                </CardDescription>
              </div>
              {!showAddForm && (
                <Button size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('card.addButton')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-8">
              {addForm}
              
              {/* 语言模型配置表格 */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('modelSections.language')}</h3>
                {languageConfigs.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-xs">{t('tableHeaders.name')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.model')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.apiUrl')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.temperature')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.default')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {languageConfigRows}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    {t('modelSections.noLanguageModels')}
                  </div>
                )}
              </div>
              
              {/* 视觉模型配置表格 */}
              <div className="space-y-4 mt-8">
                <h3 className="text-lg font-semibold">{t('modelSections.vision')}</h3>
                {visionConfigs.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8 text-xs">{t('tableHeaders.name')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.model')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.apiUrl')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.temperature')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.default')}</TableHead>
                          <TableHead className="h-8 text-xs">{t('tableHeaders.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visionConfigRows}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground border rounded-md">
                    {t('modelSections.noVisionModels')}
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

