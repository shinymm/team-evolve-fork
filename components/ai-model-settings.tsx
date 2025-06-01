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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from 'next-intl'
import type { AIModelConfig } from '@/lib/services/ai-service'
import { streamingAICall } from '@/lib/services/ai-service'
import { 
  addAIConfig, 
  deleteAIConfig, 
  setDefaultAIConfig, 
  getAIConfigsByType 
} from '@/lib/services/ai-config-service'

// Define ModelType
type ModelType = 'language' | 'vision' | 'reasoning';

// 可用的AI模型预设
const modelPresets: Array<{ name: string; baseURL: string; models: string[] }> = [
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
const visionModelPresets: Array<{ name: string; baseURL: string; models: string[] }> = [
  {
    name: 'Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-vl', 'qwen-vl-max', 'qvq-max']
  }
]

// 可用的推理模型预设 (暂定，可根据实际情况修改)
const reasoningModelPresets: Array<{ name: string; baseURL: string; models: string[] }> = [
  {
    name: 'Deepseek Reasoner',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-reasoner']
  }
];

interface AIModelSettingsProps {
  modelType: ModelType;
  onStatusChange?: (loading: boolean) => void;
}

export function AIModelSettings({ modelType, onStatusChange }: AIModelSettingsProps) {
  const t = useTranslations('AIModelSettings')
  const [configs, setConfigs] = useState<AIModelConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({})
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [selectedTab, setSelectedTab] = useState('models') // This seems to be for outer tabs, might need review if AIModelSettings is reused
  const [isLoading, setIsLoading] = useState(false)
  
  // 更新父组件的加载状态
  useEffect(() => {
    onStatusChange?.(isLoading)
  }, [isLoading, onStatusChange])
  
  // 加载指定类型的配置
  const loadConfigs = useCallback(async () => {
    try {
      setIsLoading(true)
      const loadedConfigs = await getAIConfigsByType(modelType)
      setConfigs(loadedConfigs)
    } catch (error) {
      toast({
        title: t('messages.loadFailed', { type: t(`modelTypes.${modelType}`) }),
        description: error instanceof Error ? error.message : t('messages.loadFailedDetail'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [modelType, t])

  // 初始加载
  useEffect(() => {
    loadConfigs()
  }, [loadConfigs, modelType]) // Add modelType as dependency

  // 处理预设选择
  const handlePresetChange = useCallback((preset: string) => {
    const [provider, ...modelParts] = preset.split('-')
    const model = modelParts.join('-')
    
    let baseURL = ''
    let currentPresetList;
    if (modelType === 'language') {
      currentPresetList = modelPresets;
    } else if (modelType === 'vision') {
      currentPresetList = visionModelPresets;
    } else {
      currentPresetList = reasoningModelPresets;
    }

    const providerData = currentPresetList.find(p => p.name === provider)
    if (providerData) {
      baseURL = providerData.baseURL
    }
    
    setNewConfig({
      ...newConfig,
      name: preset,
      model,
      baseURL,
      type: modelType // Set type from prop
    })
  }, [newConfig, modelType])

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
        temperature: newConfig.temperature ?? 0.7, // Default temperature
        type: modelType // Ensure type is set from prop
      }
      
      await addAIConfig(configToAdd)
      await loadConfigs() // Reload configs for the current type
      
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
  }, [newConfig, loadConfigs, modelType, t])

  // 删除配置
  const handleDeleteConfig = useCallback(async (id: string) => {
    try {
      await deleteAIConfig(id)
      await loadConfigs() // Reload configs for the current type
      
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
  }, [loadConfigs, t])

  // 设置默认配置
  const handleSetDefault = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      await setDefaultAIConfig(id)
      await loadConfigs() // Reload configs for the current type
      
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
  }, [loadConfigs, t])

  // 测试连接
  const handleTestConfig = useCallback(async (config: AIModelConfig) => {
    if (!config.id) return;
    
    setTestingId(config.id)
    setTestResults(prev => ({ ...prev, [config.id as string]: null }))
    
    const currentConfigType = config.type || modelType; // Fallback to component's modelType if config.type is undefined

    if (currentConfigType === 'reasoning') {
      console.log(`🧪 Testing REASONING model: ${config.name} against /api/ai/reasoning`);
      const formData = new FormData();
      formData.append('prompt', "测试连接,请简洁回复"); // Standard test prompt
      formData.append('modelConfigId', config.id);
      // Add systemPrompt if available and relevant for reasoning tests, though test prompt is simple
      // if (config.systemPrompt) formData.append('systemPrompt', config.systemPrompt);

      try {
        const response = await fetch('/api/ai/reasoning', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
        }
        
        // For streaming response, we might not get full JSON back directly for "success"
        // We assume if it's 200 OK and doesn't throw, the connection is good.
        // If a specific success message is expected from the stream, this part might need adjustment.
        console.log(`✅ Reasoning model ${config.name} test successful.`);
        setTestResults(prev => ({ ...prev, [config.id as string]: true }));
        toast({
          title: t('messages.testSuccess'),
          description: t('messages.testSuccessDetail', { modelName: config.name, response: "连接成功" }),
        });

      } catch (error: any) {
        console.error(`Error testing reasoning model ${config.name}:`, error);
        setTestResults(prev => ({ ...prev, [config.id as string]: false }));
        toast({
          title: t('messages.testFailed'),
          description: t('messages.testFailedDetail', { modelName: config.name, error: error.message }),
          variant: 'destructive',
        });
      } finally {
        setTestingId(null);
      }

    } else if (currentConfigType === 'vision') {
      console.log(`🧪 Testing VISION model: ${config.name} against /api/ai/vision`);
      const formData = new FormData();
      formData.append('prompt', "这张图片里有什么内容？请简洁描述。"); // Standard test prompt for vision
      formData.append('modelConfigId', config.id);
      // Add the fixed image URL for vision model testing
      formData.append('imageUrls', '["https://team-evolve.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fhero-illustration.301e146c.jpg&w=640&q=75"]');

      try {
        const response = await fetch('/api/ai/vision', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          // For vision, a 400 error "请至少提供一张图片" was previously acceptable.
          // Now, with a fixed image, any error is a real test failure.
          throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
        }
        
        console.log(`✅ Vision model ${config.name} test successful.`);
        setTestResults(prev => ({ ...prev, [config.id as string]: true }));
        toast({
          title: t('messages.testSuccess'),
          description: t('messages.testSuccessDetail', { modelName: config.name, response: "连接成功" }),
        });

      } catch (error: any) {
        console.error(`Error testing vision model ${config.name}:`, error);
        setTestResults(prev => ({ ...prev, [config.id as string]: false }));
        toast({
          title: t('messages.testFailed'),
          description: t('messages.testFailedDetail', { modelName: config.name, error: error.message }),
          variant: 'destructive',
        });
      } finally {
        setTestingId(null);
      }

    } else { // Default to language model testing (old behavior)
      console.log(`🧪 Testing LANGUAGE model (generic): ${config.name} ID: ${config.id} using streamingAICall`);
      let testHandled = false; 
      let receivedContent = false;

      try {
        const handleSuccess = () => {
          if (!testHandled) { 
            testHandled = true;
            setTestResults(prev => ({ ...prev, [config.id as string]: true }));
            toast({
              title: t('messages.testSuccess'),
              description: t('messages.testSuccessDetail', { modelName: config.name, response: "连接成功，收到数据流。" }),
            });
            setTestingId(null);
          } else {
            console.log(`☑️ [AIModelSettings] handleSuccess for ${config.id} skipped, already handled.`);
          }
        };

        const handleError = (error: any) => {
          if (!testHandled) { 
            testHandled = true;
            console.error(`Error testing language model ${config.name}:`, error);
            setTestResults(prev => ({ ...prev, [config.id as string]: false }));
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast({
              title: t('messages.testFailed'),
              description: t('messages.testFailedDetail', { modelName: config.name, error: errorMessage }),
              variant: 'destructive',
            });
            setTestingId(null);
            console.log(`❌ [AIModelSettings] handleError for ${config.id} processed, testingId set to null.`);
          } else {
            console.log(`☑️ [AIModelSettings] handleError for ${config.id} skipped, already handled.`);
          }
        };

        // Reverting to individual arguments based on the latest linter error
        streamingAICall(
          "Hello, this is a test call. Please respond with a short confirmation.", // prompt
          (content: string) => { // onContent callback with explicit type for content
            if (!receivedContent && content.trim() !== "") {
                 receivedContent = true;
            }
            if (receivedContent && !testHandled) {
                handleSuccess();
            } else {
                console.log(`💡 [AIModelSettings] Conditions NOT met for ${config.id} for handleSuccess. receivedContent: ${receivedContent}, testHandled: ${testHandled}`);
            }
          },
          handleError, // onError callback
          config.id // 新增：传递 config.id
        );

        setTimeout(() => {
          if (testingId === config.id && !receivedContent && !testHandled) {
            testHandled = true; 
            console.warn(`Language model ${config.name} test: Timeout. No content received and no explicit error.`);
            setTestResults(prev => ({ ...prev, [config.id as string]: false }));
            toast({
              title: t('messages.testFailed'),
              description: t('messages.testFailedDetail', { modelName: config.name, error: t('messages.noDataReceivedTimeout') }), 
              variant: 'destructive',
            });
            setTestingId(null);
            console.log(`⏰ [AIModelSettings] Timeout for ${config.id} processed, testingId set to null.`);
          }
        }, 5000);

      } catch (error: any) { 
        if (!testHandled) { 
          testHandled = true;
          console.error(`Synchronous error calling streamingAICall for ${config.name}:`, error);
          setTestResults(prev => ({ ...prev, [config.id as string]: false }));
          const errorMessage = error instanceof Error ? error.message : String(error);
          toast({
            title: t('messages.testFailed'),
            description: t('messages.testFailedDetail', { modelName: config.name, error: errorMessage }),
            variant: 'destructive',
          });
          setTestingId(null);
          console.log(`💥 [AIModelSettings] Sync error for ${config.name} processed, testingId set to null.`);
        }
      }
    }
  }, [modelType, t, testingId])

  // 生成配置表格行
  const configRows = useMemo(() => {
    const sortedConfigs = [...configs].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    )
    
    return sortedConfigs.map((config) => {
      if (!config.id) return null;
      
      return (
        <TableRow key={config.id}>
          <TableCell className="py-2 text-sm">{config.name}</TableCell>
          <TableCell className="py-2 text-sm">{config.model || '-'}</TableCell>
          <TableCell className="py-2 text-sm">{config.baseURL}</TableCell>
          <TableCell className="py-2 text-sm">{config.temperature ?? '0.7'}</TableCell>
          <TableCell className="py-2 text-center">
            <div
              className={cn(
                "h-3 w-3 rounded-full border border-primary cursor-pointer",
                config.isDefault && "bg-primary"
              )}
              onClick={() => handleSetDefault(config.id as string)}
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
                onClick={() => handleDeleteConfig(config.id as string)}
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
  }, [configs, testingId, testResults, handleTestConfig, handleDeleteConfig, handleSetDefault, t])


  const addForm = useMemo(() => {
    if (!showAddForm) return null
    
    let currentPresetList;
    if (modelType === 'language') {
      currentPresetList = modelPresets;
    } else if (modelType === 'vision') {
      currentPresetList = visionModelPresets;
    } else {
      currentPresetList = reasoningModelPresets;
    }
    
    return (
      <div className="space-y-3 border p-3 rounded-md bg-slate-50">
        <div className="flex justify-between items-center mb-4">
          {/* Title indicates the type of model being added implicitly via the component's modelType prop */}
          <h2 className="text-sm font-semibold">{t('addForm.titleForType', { modelType: t(`addForm.modelTypes.${modelType}`) })}</h2>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[100px,1fr] items-center gap-3">
            <Label htmlFor="ai-preset" className="text-xs">{t('addForm.fields.preset')}</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="ai-preset" className="h-8 text-sm">
                <SelectValue placeholder={t('addForm.fields.presetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {currentPresetList.map(provider => (
                  <React.Fragment key={provider.name}>
                    {provider.models.map((model: string) => (
                      <SelectItem key={`${provider.name}-${model}`} value={`${provider.name}-${model}`} className="text-sm">
                        {provider.name} - {model}
                      </SelectItem>
                    ))}
                  </React.Fragment>
                ))}
                 {currentPresetList.length === 0 && (
                  <SelectItem value="none" disabled className="text-sm">
                    {t('addForm.noPresetsAvailable')}
                  </SelectItem>
                )}
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
              value={newConfig.temperature ?? 0.7} // Default to 0.7 if undefined
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
  }, [showAddForm, newConfig, modelType, handlePresetChange, handleAddConfig, t])
  
  // The Tabs related logic might need to be handled by the parent component (AIModelsPage)
  // if AIModelSettings is now a more generic component for a single model type.
  // For now, I'll assume AIModelSettings might still be used within a tab structure,
  // or this 'selectedTab' is for internal tabs not shown in the provided snippet.
  // If AIModelSettings is always for one type, the outer Tabs (models/vector) would be in AIModelsPage.
  // The current snippet shows AIModelSettings being used inside a TabsContent for "models".
  // The original file had Tabs for "models" and "vector" at the top level of AIModelSettings.
  // I will keep the Tabs structure as it was, assuming it's still relevant for this component's internal structure
  // or its placement within a larger tabbed interface.

  // However, the prompt implies AIModelSettings is now *part* of a page that has multiple sections.
  // The `page.tsx` renders multiple AIModelSettings.
  // So, the Tabs (models/vector) should NOT be inside AIModelSettings if AIModelSettings is for ONE type.
  // The `page.tsx` has `AIModelSettings modelType="language"`, etc.
  // The `VectorSettings` is separate.
  // This means the Tabs (models/vector) logic in THIS component is incorrect for the new structure.
  // AIModelSettings should just be the Card and its contents for a given modelType.

  // Correcting: Removing the top-level Tabs (models/vector) from this component.
  // The parent page (AIModelsPage) will handle the layout of multiple AIModelSettings instances.

  const sectionTitle = useMemo(() => {
    if (modelType === 'language') return t('modelSections.language');
    if (modelType === 'vision') return t('modelSections.vision');
    if (modelType === 'reasoning') return t('modelSections.reasoning');
    return t('card.title'); // Fallback
  }, [modelType, t]);

  const noConfigsMessage = useMemo(() => {
    if (modelType === 'language') return t('modelSections.noLanguageModels');
    if (modelType === 'vision') return t('modelSections.noVisionModels');
    if (modelType === 'reasoning') return t('modelSections.noReasoningModels');
    return "";
  }, [modelType, t]);


  return (
    // Removed Tabs -> TabsList -> TabsTrigger and TabsContent for "models" and "vector"
    // This component now renders the settings for a single modelType
    <Card className="w-full">
      <CardHeader className="pb-6">
        <div className="flex justify-between items-center">
          <div>
            {/* The title is now passed from page.tsx, so this CardTitle might be redundant or need re-evaluation */}
            {/* For now, let's use a generic title or one based on modelType */}
            <CardTitle className="text-xl font-bold mb-1">{t('card.titleForType', { modelType: t(`addForm.modelTypes.${modelType}`) })}</CardTitle>
            <CardDescription className="text-base">
              {t('card.descriptionForType', { modelType: t(`addForm.modelTypes.${modelType}`) })}
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
          
          {/* Config Table for the given modelType */}
          <div className="space-y-4">
            {/* The h3 title is now handled by the parent page. */}
            {/* <h3 className="text-lg font-semibold">{sectionTitle}</h3> */}
            {configs.length > 0 ? (
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
                    {configRows}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground border rounded-md">
                {noConfigsMessage}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    // The TabsContent for "vector" and VectorSettings component are removed from here.
    // The AIModelsPage will orchestrate AIModelSettings and VectorSettings separately if needed.
  )
}

// export default AIModelSettings // Default export might not be needed if named export is used consistently
                                // Keeping it as it was in the original file.
export default AIModelSettings;

