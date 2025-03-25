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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search } from 'lucide-react'

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
  temperature?: number
  isDefault: boolean
}

interface PromptTest {
  id: string
  prompt: string
  parameters: Parameter[]
  createdAt: string
}

export default function PromptDebugPage() {
  const [prompt, setPrompt] = useState<string>('')
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [outputs, setOutputs] = useState<ModelOutput[]>([])
  const [savedTests, setSavedTests] = useState<PromptTest[]>([])
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { toast } = useToast()

  // 获取可用的模型列表
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/ai-config/models')
        const data = await response.json()
        if (data.error) {
          throw new Error(data.error)
        }
        setAvailableModels(data.models)
      } catch (error) {
        toast({
          title: "获取模型列表失败",
          description: error instanceof Error ? error.message : "请稍后重试",
          variant: "destructive",
          duration: 3000
        })
      }
    }

    fetchModels()
  }, [])

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
          title: "获取测试数据集失败",
          description: error instanceof Error ? error.message : "请稍后重试",
          variant: "destructive",
          duration: 3000
        })
      }
    }

    if (isLoadDialogOpen) {
      fetchSavedTests()
    }
  }, [isLoadDialogOpen])

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

  // 运行提示词
  const runPrompt = async () => {
    if (!prompt.trim()) {
      toast({
        title: "提示词不能为空",
        description: "请输入提示词内容",
        variant: "destructive",
        duration: 3000
      })
      return
    }

    if (selectedModels.length === 0) {
      toast({
        title: "请选择模型",
        description: "至少选择一个模型进行测试",
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
        // 获取模型配置
        const modelConfig = availableModels.find(m => m.id === modelId)
        if (!modelConfig) {
          throw new Error(`未找到模型配置: ${modelId}`)
        }

        // 使用streamingAICall进行流式调用
        await streamingAICall(
          finalPrompt,
          modelConfig,
          (content) => {
            // 更新对应模型的输出内容
            setOutputs(prev => 
              prev.map(output => 
                output.modelId === modelId
                  ? { 
                      ...output, 
                      content: output.content + content,
                      loading: false 
                    }
                  : output
              )
            )
          },
          (error) => {
            // 处理错误情况
            setOutputs(prev => 
              prev.map(output => 
                output.modelId === modelId
                  ? { 
                      ...output, 
                      content: `错误: ${error}`,
                      loading: false 
                    }
                  : output
              )
            )
            
            toast({
              title: `模型 ${modelConfig.name} 调用失败`,
              description: error,
              variant: "destructive",
              duration: 3000
            })
          }
        )
      } catch (error) {
        // 处理整体调用错误
        setOutputs(prev => 
          prev.map(output => 
            output.modelId === modelId
              ? { 
                  ...output, 
                  content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
                  loading: false 
                }
              : output
          )
        )

        toast({
          title: `模型调用失败`,
          description: error instanceof Error ? error.message : '未知错误',
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
          parameters
        })
      })

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      toast({
        title: "保存成功",
        description: "测试数据集已保存",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "请稍后重试",
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
      title: "加载成功",
      description: "测试数据集已加载",
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
        title: "清空成功",
        description: "测试数据集缓存已清空",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "清空失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">提示词调试</h1>
        <div className="flex items-center gap-4">
          <Button
            onClick={clearTestCache}
            variant="outline"
            size="sm"
            className="text-orange-500 hover:text-orange-700 hover:border-orange-200"
          >
            清空缓存测试数据集
          </Button>
          <Button
            onClick={saveTest}
            disabled={!prompt.trim()}
            variant="outline"
            size="sm"
          >
            保存测试数据集
          </Button>
          <Button
            onClick={() => setIsLoadDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            加载测试数据集
          </Button>
          <Button
            onClick={runPrompt}
            disabled={selectedModels.length === 0 || !prompt.trim()}
            size="sm"
            className="px-6 bg-orange-500 hover:bg-orange-600"
          >
            运行
          </Button>
        </div>
      </div>

      {/* 加载测试数据集对话框 */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="w-[60vw] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>加载测试数据集</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="搜索测试数据集..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {filteredTests.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  {searchQuery ? '未找到匹配的测试数据集' : '暂无测试数据集'}
                </div>
              ) : (
                filteredTests.map((test) => (
                  <div
                    key={test.id}
                    className="p-4 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => loadTest(test)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-gray-500">
                        {new Date(test.createdAt).toLocaleString()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          loadTest(test)
                        }}
                      >
                        加载
                      </Button>
                    </div>
                    <div className="text-sm line-clamp-3">
                      {test.prompt}
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

      <div className="grid grid-cols-12 gap-6">
        {/* 左侧输入区域 */}
        <div className="col-span-4 space-y-6">
          {/* 提示词编辑区 */}
          <Card className="p-6 bg-slate-50">
            <Label htmlFor="prompt" className="text-lg font-semibold mb-3 block">
              提示词模板
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="输入提示词，使用 {{参数名}} 标记参数..."
              className="min-h-[200px] font-mono resize-y bg-white"
            />
          </Card>

          {/* 参数输入区 */}
          {parameters.length > 0 && (
            <Card className="p-6 bg-slate-50">
              <h2 className="text-lg font-semibold mb-4">参数设置</h2>
              <div className="space-y-4">
                {parameters.map((param, index) => (
                  <div key={index} className="space-y-2">
                    <Label
                      htmlFor={`param-${param.name}`}
                      className="flex items-center gap-2"
                    >
                      <span>{param.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">
                        参数
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
                      className="h-24 bg-white"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 模型选择区 */}
          <Card className="p-6 bg-slate-50">
            <h2 className="text-lg font-semibold mb-4">选择模型（最多3个）</h2>
            <div className="space-y-2">
              {availableModels.map((model) => (
                <div
                  key={model.id}
                  className={`p-3 rounded-lg border ${
                    selectedModels.includes(model.id)
                      ? 'border-slate-300 bg-white'
                      : 'hover:border-slate-300 bg-white'
                  } transition-colors`}
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={model.id}
                      checked={selectedModels.includes(model.id)}
                      onCheckedChange={() => handleModelSelect(model.id)}
                      disabled={!selectedModels.includes(model.id) && selectedModels.length >= 3}
                    />
                    <Label htmlFor={model.id}>{model.name}</Label>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 右侧输出区域 */}
        <div className="col-span-8">
          <div className="sticky top-6">
            {outputs.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {outputs.map((output) => (
                  <Card key={output.modelId} className="p-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center justify-between">
                      <span>{availableModels.find(m => m.id === output.modelId)?.name}</span>
                      {output.loading && (
                        <span className="text-sm text-gray-500">处理中...</span>
                      )}
                    </h3>
                    <ScrollArea className="h-[calc((100vh-20rem)/3)] w-full rounded-md border p-4">
                      {output.loading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-sm">{output.content}</pre>
                      )}
                    </ScrollArea>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="h-[calc(100vh-8rem)] flex items-center justify-center border-2 border-dashed rounded-lg">
                <div className="text-center text-gray-500">
                  <p className="text-lg font-semibold">暂无输出结果</p>
                  <p className="text-sm">请输入提示词并选择模型后运行</p>
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