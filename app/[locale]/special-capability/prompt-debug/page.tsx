'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { streamingAICall } from '@/lib/services/ai-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Download, Plus, Trash2, Edit, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Parameter {
  name: string
  value: string
}

interface ModelOutput {
  modelId: string
  content: string
  loading: boolean
}

interface AIModel {
  id: string
  name: string
  model: string
  baseURL: string
  apiKey: string
  temperature: number
  isDefault: boolean
  _encrypted?: boolean
}

interface PromptTest {
  id: string
  prompt: string
  parameters: Parameter[]
  createdAt: string
  description: string
}

export default function PromptDebugPage() {
  // 获取翻译
  const t = useTranslations()
  
  // 输出原始消息
  console.log('翻译测试:', { 
    directTest: '提示词模板',
    testTranslation: t('PromptDebugPage.promptSection.title'),
    promptSectionTitle: t.raw('PromptDebugPage')?.promptSection?.title || '未找到翻译',
    nestedTest: t.raw('PromptDebugPage')?.promptSection?.title || '未找到翻译'
  })
  
  const [prompt, setPrompt] = useState<string>('')
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [outputs, setOutputs] = useState<ModelOutput[]>([])
  const [outputHeights, setOutputHeights] = useState<Record<string, number>>({})
  const [savedTests, setSavedTests] = useState<PromptTest[]>([])
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()
  const [modelTemps, setModelTemps] = useState<Record<string, number>>({})
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [description, setDescription] = useState('')
  
  // 新增状态
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false)
  const [newModel, setNewModel] = useState<AIModel>({
    id: '',
    name: '',
    model: '',
    baseURL: '',
    apiKey: '',
    temperature: 0.7,
    isDefault: false
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [modelPresets, setModelPresets] = useState([
    {
      name: t.raw('PromptDebugPage')?.modelPresets?.openai || 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4o','gpt-4o-mini','gpt-3.5-turbo']
    },
    {
      name: t.raw('PromptDebugPage')?.modelPresets?.zhipu || 'ZhipuAI',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      models: ['glm-4-long', 'glm-4-flash']
    },
    {
      name: t.raw('PromptDebugPage')?.modelPresets?.qwen || 'Qwen',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      models: ['qwen-long']
    },
    {
      name: t.raw('PromptDebugPage')?.modelPresets?.deepseek || 'DeepSeek',
      baseURL: 'https://api.deepseek.com',
      models: ['deepseek-chat']
    },
    {
      name: t.raw('PromptDebugPage')?.modelPresets?.gemini || 'Google Gemini',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      models: ['gemini-2.0-flash-lite','gemini-2.0-flash-thinking-exp-01-21']
    }
  ])
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [selectedPresetModel, setSelectedPresetModel] = useState<string>('')

  // 获取可用的模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        // 使用新的专用API端点
        const response = await fetch('/api/prompt-debug-models')
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
        setAvailableModels(data.models || [])
      } catch (error) {
        console.error(t.raw('PromptDebugPage')?.notifications?.getModelsFailed || 'Failed to get models', error)
        // 失败时不显示错误提示，静默处理
        setAvailableModels([])
      }
    }

    fetchModels()
  }, [t])

  // 从提示词中提取参数
  useEffect(() => {
    const paramRegex = /{{(.*?)}}/g
    const matches = [...prompt.matchAll(paramRegex)]
    const newParams = matches.map(match => ({
      name: match[1],
      value: ''
    }))
    
    // 保留已有参数的值
    const updatedParams = newParams.map(newParam => {
      const existingParam = parameters.find(p => p.name === newParam.name)
      return existingParam || newParam
    })
    
    setParameters(updatedParams)
  }, [prompt])

  // 获取保存的测试数据集
  useEffect(() => {
    const fetchSavedTests = async () => {
      try {
        const response = await fetch('/api/prompt-test')
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
        setSavedTests(data.tests)
      } catch (error) {
        toast({
          title: t('PromptDebugPage.notifications.getTestsFailed'),
          description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
          variant: "destructive",
          duration: 3000
        })
      }
    }

    if (isLoadDialogOpen) {
      fetchSavedTests()
    }
  }, [isLoadDialogOpen, t, toast])

  // 处理模型选择
  const handleModelSelect = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId)
      }
      if (prev.length >= 3) {
        return prev
      }
      return [...prev, modelId]
    })
  }

  // 替换提示词中的参数
  const replaceParameters = (promptTemplate: string, params: Parameter[]) => {
    let result = promptTemplate
    params.forEach(param => {
      result = result.replace(new RegExp(`{{${param.name}}}`, 'g'), param.value)
    })
    return result
  }

  // 处理温度调整
  const handleTempChange = (modelId: string, value: string) => {
    const temp = parseFloat(value)
    if (!isNaN(temp) && temp >= 0 && temp <= 1) {
      setModelTemps(prev => ({
        ...prev,
        [modelId]: temp
      }))
    }
  }

  // 运行提示词
  const runPrompt = async () => {
    if (!prompt.trim()) {
      toast({
        title: t.raw('PromptDebugPage')?.notifications?.promptEmpty || 'Empty Prompt',
        description: t.raw('PromptDebugPage')?.notifications?.promptEmptyDesc || 'Please enter a prompt before running',
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (selectedModels.length === 0) {
      toast({
        title: t.raw('PromptDebugPage')?.notifications?.noModels || 'No Models Selected',
        description: t.raw('PromptDebugPage')?.notifications?.noModelsDesc || 'Please select at least one model',
        variant: "destructive",
        duration: 3000
      })
      return
    }

    const finalPrompt = replaceParameters(prompt, parameters)
    
    // 重置输出状态
    setOutputs(selectedModels.map(modelId => ({
      modelId,
      content: '',
      loading: true
    })))

    // 为每个选中的模型创建独立的流式连接
    selectedModels.forEach(async (modelId) => {
      try {
        // 获取模型配置并应用自定义温度
        const modelConfig = availableModels.find(m => m.id === modelId)
        if (!modelConfig) {
          throw new Error(t('PromptDebugPage.notifications.modelConfigNotFound', { modelId }))
        }

        // 使用新的流式API
        const response = await fetch('/api/prompt-debug-models/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            modelId: modelId,
            temperature: modelId in modelTemps ? modelTemps[modelId] : (modelConfig.temperature || 0.7)
          })
        })

        if (!response.ok) {
          let errorMessage = `${t('PromptDebugPage.notifications.httpError')} ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // 解析错误时使用默认错误信息
          }
          throw new Error(errorMessage);
        }

        // 确保是流式响应
        if (!response.body) {
          throw new Error(t('PromptDebugPage.notifications.connectionError'));
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // 读取流式响应
        let responseText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 解码并处理返回的文本块
          const text = decoder.decode(value);
          responseText += text;

          // 更新对应模型的输出内容
          setOutputs(prev => 
            prev.map(output => 
              output.modelId === modelId
                ? { 
                    ...output, 
                    content: responseText,
                    loading: false 
                  }
                : output
            )
          )
        }
      } catch (error) {
        // 处理整体调用错误
        setOutputs(prev => 
          prev.map(output => 
            output.modelId === modelId
              ? { 
                  ...output, 
                  content: `${t('PromptDebugPage.notifications.errorPrefix')} ${error instanceof Error ? error.message : t('PromptDebugPage.notifications.unknownError')}`,
                  loading: false 
                }
              : output
          )
        )

        toast({
          title: t('PromptDebugPage.notifications.modelError'),
          description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.unknownError'),
          variant: "destructive",
          duration: 3000
        })
      }
    })
  }

  // 保存测试数据集
  const saveTest = async () => {
    try {
      const response = await fetch('/api/prompt-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          parameters,
          description
        })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setIsSaveDialogOpen(false)
      setDescription('')
      
      toast({
        title: t('PromptDebugPage.notifications.saveSuccess'),
        description: t('PromptDebugPage.notifications.saveSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('PromptDebugPage.notifications.saveFailed'),
        description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 加载测试数据集
  const loadTest = (test: PromptTest) => {
    setPrompt(test.prompt)
    setParameters(test.parameters)
    setIsLoadDialogOpen(false)
    toast({
      title: t('PromptDebugPage.notifications.loadSuccess'),
      description: t('PromptDebugPage.notifications.loadSuccessDesc'),
      duration: 3000
    })
  }

  // 过滤测试数据集
  const filteredTests = savedTests.filter(test =>
    test.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 清空测试数据集缓存
  const clearTestCache = async () => {
    try {
      const response = await fetch('/api/prompt-test/clear', {
        method: 'POST'
      })
      
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setSavedTests([]) // 清空本地缓存的测试数据集
      setSearchQuery('') // 重置搜索
      
      toast({
        title: t('PromptDebugPage.notifications.clearCacheSuccess'),
        description: t('PromptDebugPage.notifications.clearCacheSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('PromptDebugPage.notifications.clearCacheFailed'),
        description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 删除单条测试数据集
  const deleteTest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发加载事件
    
    try {
      const response = await fetch('/api/prompt-test/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      // 从本地状态中移除
      setSavedTests(prev => prev.filter(test => test.id !== id))

      toast({
        title: t('PromptDebugPage.notifications.deleteSuccess'),
        description: t('PromptDebugPage.notifications.deleteSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('PromptDebugPage.notifications.deleteFailed'),
        description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 清除所有输入输出
  const handleClear = () => {
    setPrompt('')
    setParameters([])
    setSelectedModels([])
    setOutputs([])
    setModelTemps({})
    toast({
      title: t('PromptDebugPage.notifications.clearSuccess'),
      description: t('PromptDebugPage.notifications.clearSuccessDesc'),
      duration: 3000
    })
  }

  // 下载输出结果
  const handleDownload = (modelId: string, content: string) => {
    const model = availableModels.find(m => m.id === modelId)
    const modelName = model?.name || 'unknown'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${modelName}-output-${timestamp}.txt`
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: t('PromptDebugPage.notifications.downloadSuccess'),
      description: t('PromptDebugPage.notifications.downloadSuccessDesc', { fileName }),
      duration: 3000
    })
  }

  // 处理模型预设选择
  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName)
    setSelectedPresetModel('')
    
    const preset = modelPresets.find(p => p.name === presetName)
    if (preset) {
      setNewModel(prev => ({
        ...prev,
        baseURL: preset.baseURL
      }))
    }
  }

  // 处理模型类型选择
  const handleModelTypeChange = (modelType: string) => {
    setSelectedPresetModel(modelType)
    setNewModel(prev => ({
      ...prev,
      model: modelType,
      name: `${selectedPreset} - ${modelType}` // 自动生成名称
    }))
  }

  // 打开新增模型对话框
  const openAddModelDialog = () => {
    setNewModel({
      id: '',
      name: '',
      model: '',
      baseURL: '',
      apiKey: '',
      temperature: 0.7,
      isDefault: false
    })
    setSelectedPreset('')
    setSelectedPresetModel('')
    setIsEditMode(false)
    setIsModelDialogOpen(true)
  }

  // 打开编辑模型对话框
  const openEditModelDialog = (model: AIModel) => {
    setNewModel({...model})
    setIsEditMode(true)
    setIsModelDialogOpen(true)
    
    // 尝试匹配预设
    const preset = modelPresets.find(p => p.baseURL === model.baseURL)
    if (preset) {
      setSelectedPreset(preset.name)
      if (preset.models.includes(model.model)) {
        setSelectedPresetModel(model.model)
      } else {
        setSelectedPresetModel('')
      }
    } else {
      setSelectedPreset('')
      setSelectedPresetModel('')
    }
  }

  // 保存模型配置
  const saveModelConfig = async () => {
    // 基本验证
    if (!newModel.name || !newModel.model || !newModel.baseURL || !newModel.apiKey) {
      toast({
        title: t('PromptDebugPage.notifications.inputIncomplete'),
        description: t('PromptDebugPage.notifications.inputIncompleteDesc'),
        variant: "destructive",
        duration: 3000
      })
      return
    }

    try {
      const modelToSave = {
        ...newModel,
        id: newModel.id || `model_${Date.now()}`
      }

      // 使用新的专用API端点
      const response = await fetch('/api/prompt-debug-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: modelToSave })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      // 更新本地状态
      if (isEditMode) {
        setAvailableModels(prev => 
          prev.map(m => m.id === modelToSave.id ? modelToSave : m)
        )
      } else {
        setAvailableModels(prev => [...prev, modelToSave])
      }

      setIsModelDialogOpen(false)
      
      // 根据模式选择不同的消息
      const successTitle = isEditMode 
        ? t('PromptDebugPage.notifications.modelUpdateSuccess') 
        : t('PromptDebugPage.notifications.modelAddSuccess')
      
      const successDesc = isEditMode 
        ? t('PromptDebugPage.notifications.modelUpdateSuccessDesc', { name: modelToSave.name }) 
        : t('PromptDebugPage.notifications.modelAddSuccessDesc', { name: modelToSave.name })
      
      toast({
        title: successTitle,
        description: successDesc,
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('PromptDebugPage.notifications.modelSaveFailed'),
        description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 删除模型配置
  const deleteModelConfig = async (modelId: string) => {
    try {
      // 使用新的专用API端点
      const response = await fetch('/api/prompt-debug-models/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: modelId })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      // 更新本地状态
      setAvailableModels(prev => prev.filter(m => m.id !== modelId))
      
      // 如果被删除的模型在已选列表中，也移除
      setSelectedModels(prev => prev.filter(id => id !== modelId))

      toast({
        title: t('PromptDebugPage.notifications.modelDeleteSuccess'),
        description: t('PromptDebugPage.notifications.modelDeleteSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      toast({
        title: t('PromptDebugPage.notifications.modelDeleteFailed'),
        description: error instanceof Error ? error.message : t('PromptDebugPage.notifications.tryAgainLater'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 自动填充测试API密钥（仅用于测试模型配置）
  const autoFillTestApiKey = () => {
    const presetApiKeys: Record<string, string> = {
      [t.raw('PromptDebugPage')?.modelPresets?.openai || 'OpenAI']: 'sk-...',
      [t.raw('PromptDebugPage')?.modelPresets?.zhipu || 'ZhipuAI']: 'Bearer ...',
      [t.raw('PromptDebugPage')?.modelPresets?.qwen || 'Qwen']: 'sk-...',
      [t.raw('PromptDebugPage')?.modelPresets?.deepseek || 'DeepSeek']: 'sk-...',
      [t.raw('PromptDebugPage')?.modelPresets?.gemini || 'Google Gemini']: 'API_KEY ...'
    }

    if (selectedPreset && presetApiKeys[selectedPreset]) {
      setNewModel(prev => ({
        ...prev,
        apiKey: prev.apiKey || presetApiKeys[selectedPreset]
      }))
    }
  }

  return (
    <div className="mx-auto py-4 w-[90%]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">{t.raw('PromptDebugPage')?.title || 'Prompt Debugging'}</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="text-orange-500 hover:text-orange-700 hover:border-orange-200"
          >
            {t.raw('PromptDebugPage')?.clear || 'Clear All'}
          </Button>
          <Button
            onClick={clearTestCache}
            variant="outline"
            size="sm"
            className="text-orange-500 hover:text-orange-700 hover:border-orange-200"
          >
            {t.raw('PromptDebugPage')?.clearCache || 'Clear Cache'}
          </Button>
          <Button
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!prompt.trim()}
            variant="outline"
            size="sm"
          >
            {t.raw('PromptDebugPage')?.saveTest || 'Save Test'}
          </Button>
          <Button
            onClick={() => setIsLoadDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            {t.raw('PromptDebugPage')?.loadTest || 'Load Test'}
          </Button>
          <Button
            onClick={runPrompt}
            disabled={selectedModels.length === 0 || !prompt.trim()}
            size="sm"
            className="px-6 bg-orange-500 hover:bg-orange-600"
          >
            {t.raw('PromptDebugPage')?.run || 'Run'}
          </Button>
        </div>
      </div>

      {/* 保存测试数据集对话框 */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base">{t.raw('PromptDebugPage')?.saveDialog?.title || 'Save Test Dataset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">{t.raw('PromptDebugPage')?.saveDialog?.description || 'Description'}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 20))}
                placeholder={t.raw('PromptDebugPage')?.saveDialog?.description || 'Description'}
                className="w-full text-sm"
              />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-sm"
              >
                {t.raw('PromptDebugPage')?.saveDialog?.cancel || 'Cancel'}
              </Button>
              <Button
                onClick={saveTest}
                disabled={!description.trim()}
                className="text-sm"
              >
                {t.raw('PromptDebugPage')?.saveDialog?.save || 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 加载测试数据集对话框 */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="w-[60vw] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base">{t.raw('PromptDebugPage')?.loadDialog?.title || 'Load Test Dataset'}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder={t.raw('PromptDebugPage')?.loadDialog?.searchPlaceholder || 'Search test datasets...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {filteredTests.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">
                  {searchQuery ? 
                    (t.raw('PromptDebugPage')?.loadDialog?.noResults || 'No matching test datasets found') : 
                    (t.raw('PromptDebugPage')?.loadDialog?.noTests || 'No test datasets available')
                  }
                </div>
              ) : (
                filteredTests.map((test) => (
                  <div
                    key={test.id}
                    className="p-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => loadTest(test)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{test.description}</span>
                        <span>|</span>
                        <span>{new Date(test.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50 text-xs"
                          onClick={(e) => deleteTest(test.id, e)}
                        >
                          {t.raw('PromptDebugPage')?.loadDialog?.delete || 'Delete'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            loadTest(test)
                          }}
                        >
                          {t.raw('PromptDebugPage')?.loadDialog?.load || 'Load'}
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs line-clamp-3">
                      {test.prompt.length > 100 ? `${test.prompt.slice(0, 100)}...` : test.prompt}
                    </div>
                    {test.parameters.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {test.parameters.map(param => (
                          <span
                            key={param.name}
                            className="px-2 py-0.5 bg-secondary/50 rounded-full text-xs"
                          >
                            {param.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 模型配置对话框 */}
      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent className="w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {isEditMode 
                ? (t.raw('PromptDebugPage')?.modelDialog?.editTitle || 'Edit Model')
                : (t.raw('PromptDebugPage')?.modelDialog?.addTitle || 'Add New Model')
              }
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              {t.raw('PromptDebugPage')?.modelDialog?.description || 'Configure large language models for prompt debugging'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-2">
              {modelPresets.map(preset => (
                <Button
                  key={preset.name}
                  type="button"
                  variant={selectedPreset === preset.name ? "secondary" : "outline"}
                  className="text-xs h-8"
                  onClick={() => handlePresetChange(preset.name)}
                >
                  {preset.name}
                </Button>
              ))}
            </div>

            {selectedPreset && (
              <div className="space-y-2">
                <Label className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.modelTypesLabel || 'Select model type'}</Label>
                <div className="flex flex-wrap gap-2">
                  {modelPresets.find(p => p.name === selectedPreset)?.models.map(model => (
                    <Button
                      key={model}
                      type="button"
                      variant={selectedPresetModel === model ? "secondary" : "outline"}
                      className="text-xs h-8"
                      onClick={() => handleModelTypeChange(model)}
                    >
                      {model}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="model-name" className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.nameLabel || 'Model Name'}</Label>
              <Input
                id="model-name"
                value={newModel.name}
                onChange={(e) => setNewModel(prev => ({...prev, name: e.target.value}))}
                placeholder={t.raw('PromptDebugPage')?.modelDialog?.namePlaceholder || 'e.g., My GPT-4'}
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model-type" className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.typeLabel || 'Model Type'}</Label>
              <Input
                id="model-type"
                value={newModel.model}
                onChange={(e) => setNewModel(prev => ({...prev, model: e.target.value}))}
                placeholder={t.raw('PromptDebugPage')?.modelDialog?.typePlaceholder || 'e.g., gpt-4'}
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base-url" className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.urlLabel || 'API Base URL'}</Label>
              <Input
                id="base-url"
                value={newModel.baseURL}
                onChange={(e) => setNewModel(prev => ({...prev, baseURL: e.target.value}))}
                placeholder={t.raw('PromptDebugPage')?.modelDialog?.urlPlaceholder || 'e.g., https://api.openai.com/v1'}
                className="w-full text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="api-key" className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.keyLabel || 'API Key'}</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-6 px-2"
                  onClick={autoFillTestApiKey}
                >
                  {t.raw('PromptDebugPage')?.modelDialog?.autoFillTest || 'Auto-fill test key'}
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="api-key"
                  type="password"
                  value={newModel.apiKey}
                  onChange={(e) => setNewModel(prev => ({...prev, apiKey: e.target.value}))}
                  placeholder={t.raw('PromptDebugPage')?.modelDialog?.keyLabel || 'API Key'}
                  className="w-full text-sm pr-10"
                />
                <div className="absolute right-3 top-2 text-xs text-gray-400">
                  {t.raw('PromptDebugPage')?.modelDialog?.encrypted || 'Encrypted'}
                </div>
              </div>
              <p className="text-xs text-gray-500">{t.raw('PromptDebugPage')?.modelDialog?.encryptedNote || 'API keys will be stored in encrypted form'}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature" className="text-sm">{t.raw('PromptDebugPage')?.modelDialog?.tempLabel || 'Default Temperature'}</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="temperature"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={newModel.temperature}
                  onChange={(e) => setNewModel(prev => ({...prev, temperature: parseFloat(e.target.value)}))}
                  className="w-24 text-sm"
                />
                <span className="text-xs text-gray-500">{t.raw('PromptDebugPage')?.modelDialog?.tempRange || 'Range: 0-1'}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsModelDialogOpen(false)}
                className="text-sm"
              >
                {t.raw('PromptDebugPage')?.modelDialog?.cancel || 'Cancel'}
              </Button>
              <Button
                onClick={saveModelConfig}
                className="text-sm"
              >
                {t.raw('PromptDebugPage')?.modelDialog?.save || 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-12 gap-4">
        {/* 左侧输入区域 */}
        <div className="col-span-4 space-y-4">
          {/* 提示词编辑区 */}
          <Card className="p-3 bg-slate-50">
            <Label htmlFor="prompt" className="text-sm font-semibold mb-2 block">
              {t.raw('PromptDebugPage')?.promptSection?.title || 'Prompt Template'}
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.raw('PromptDebugPage')?.promptSection?.placeholder || 'Enter your prompt...'}
              className="min-h-[200px] font-mono text-xs resize-y bg-white"
            />
          </Card>

          {/* 参数输入区 */}
          {parameters.length > 0 && (
            <Card className="p-3 bg-slate-50">
              <h2 className="text-sm font-semibold mb-2">{t.raw('PromptDebugPage')?.parametersSection?.title || 'Parameter Settings'}</h2>
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <div key={index} className="space-y-1">
                    <Label
                      htmlFor={`param-${param.name}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span>{param.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px]">
                        {t.raw('PromptDebugPage')?.parametersSection?.paramLabel || 'Parameter'}
                      </span>
                    </Label>
                    <Textarea
                      id={`param-${param.name}`}
                      value={param.value}
                      onChange={(e) => {
                        const newParams = [...parameters]
                        newParams[index].value = e.target.value
                        setParameters(newParams)
                      }}
                      className="h-20 bg-white text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 模型选择区 */}
          <Card className="p-3 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">{t.raw('PromptDebugPage')?.modelSection?.title || 'Select Models'}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={openAddModelDialog}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {availableModels.length === 0 ? (
              <div className="text-center py-6 border border-dashed rounded-lg">
                <p className="text-sm text-gray-500">{t.raw('PromptDebugPage')?.modelSection?.noModels || 'No model configurations'}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={openAddModelDialog}
                >
                  {t.raw('PromptDebugPage')?.modelSection?.addModel || 'Add Model'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    className={`p-2 rounded-lg border ${
                      selectedModels.includes(model.id)
                        ? 'border-slate-300 bg-white'
                        : 'hover:border-slate-300 bg-white'
                    } transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={model.id}
                          checked={selectedModels.includes(model.id)}
                          onCheckedChange={() => handleModelSelect(model.id)}
                          disabled={!selectedModels.includes(model.id) && selectedModels.length >= 3}
                          className="h-3 w-3"
                        />
                        <Label htmlFor={model.id} className="text-xs">
                          {model.name}
                          <span className="ml-1 text-[10px] text-gray-500">({model.model})</span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center space-x-1">
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            {t.raw('PromptDebugPage')?.modelSection?.temperature || 'Temp:'} {model.temperature || 0.7}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={model.id in modelTemps ? modelTemps[model.id] : (model.temperature || 0.7)}
                            onChange={(e) => handleTempChange(model.id, e.target.value)}
                            className="w-16 h-5 text-[11px] px-1"
                            placeholder="0-1"
                          />
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => openEditModelDialog(model)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteModelConfig(model.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 右侧输出区域 */}
        <div className="col-span-8">
          <div className="sticky top-6">
            {outputs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {outputs.map((output) => (
                  <Card key={output.modelId} className="p-3">
                    <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                      <span>{availableModels.find(m => m.id === output.modelId)?.name}</span>
                      <div className="flex items-center gap-2">
                        {!output.loading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-slate-100"
                            onClick={() => handleDownload(output.modelId, output.content)}
                          >
                            <Download className="h-4 w-4 text-slate-600" />
                          </Button>
                        )}
                        {output.loading && (
                          <span className="text-xs text-gray-500">{t.raw('PromptDebugPage')?.outputSection?.processing || 'Processing...'}</span>
                        )}
                      </div>
                    </h3>
                    <ScrollArea 
                      className={`w-full rounded-md border p-3 resize-y overflow-hidden`}
                      style={{
                        height: outputHeights[output.modelId] || 'calc((100vh - 20rem)/3)',
                        minHeight: '150px',
                        maxHeight: 'calc(100vh - 10rem)'
                      }}
                      onMouseUp={(e) => {
                        const element = e.currentTarget as HTMLElement;
                        setOutputHeights(prev => ({
                          ...prev,
                          [output.modelId]: element.clientHeight
                        }));
                      }}
                    >
                      {output.loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-xs">{output.content}</pre>
                      )}
                    </ScrollArea>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="h-[calc(100vh-8rem)] flex items-center justify-center border-2 border-dashed rounded-lg">
                <div className="text-center text-gray-500">
                  <p className="text-sm font-semibold">{t.raw('PromptDebugPage')?.outputSection?.noOutput || 'No output results'}</p>
                  <p className="text-xs">{t.raw('PromptDebugPage')?.outputSection?.noOutputDescription || 'Enter a prompt and select models, then run'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  )
} 