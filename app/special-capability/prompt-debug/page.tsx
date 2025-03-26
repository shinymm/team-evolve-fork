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
import { Search, Download } from 'lucide-react'

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
}

interface PromptTest {
  id: string
  prompt: string
  parameters: Parameter[]
  createdAt: string
  description: string
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
  const [modelTemps, setModelTemps] = useState<Record<string, number>>({})
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [description, setDescription] = useState('')

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
        // 获取模型配置并应用自定义温度
        const modelConfig = availableModels.find(m => m.id === modelId)
        if (!modelConfig) {
          throw new Error(`未找到模型配置: ${modelId}`)
        }

        // 使用自定义温度覆盖原始配置
        const finalConfig = {
          ...modelConfig,
          temperature: modelId in modelTemps ? modelTemps[modelId] : (modelConfig.temperature || 0.7)
        }

        // 使用 finalConfig 调用 streamingAICall
        await streamingAICall(
          finalPrompt,
          finalConfig,
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
        title: "删除成功",
        description: "测试数据集已删除",
        duration: 3000
      })
    } catch (error) {
      toast({
        title: "删除失败",
        description: error instanceof Error ? error.message : "请稍后重试",
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
      title: "已清除",
      description: "所有输入输出已清除",
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
      title: "下载成功",
      description: `已下载 ${fileName}`,
      duration: 3000
    })
  }

  return (
    <div className="mx-auto py-4 w-[90%]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">提示词调试</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleClear}
            variant="outline"
            size="sm"
            className="text-orange-500 hover:text-orange-700 hover:border-orange-200"
          >
            Clear
          </Button>
          <Button
            onClick={clearTestCache}
            variant="outline"
            size="sm"
            className="text-orange-500 hover:text-orange-700 hover:border-orange-200"
          >
            清空缓存测试数据集
          </Button>
          <Button
            onClick={() => setIsSaveDialogOpen(true)}
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

      {/* 保存测试数据集对话框 */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base">保存测试数据集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">描述信息（20字内）</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 20))}
                placeholder="请输入描述信息..."
                className="w-full text-sm"
              />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-sm"
              >
                取消
              </Button>
              <Button
                onClick={saveTest}
                disabled={!description.trim()}
                className="text-sm"
              >
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 加载测试数据集对话框 */}
      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogContent className="w-[60vw] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-base">加载测试数据集</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="搜索测试数据集..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 pr-4">
              {filteredTests.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">
                  {searchQuery ? '未找到匹配的测试数据集' : '暂无测试数据集'}
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
                          删除
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
                          加载
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

      <div className="grid grid-cols-12 gap-4">
        {/* 左侧输入区域 */}
        <div className="col-span-4 space-y-4">
          {/* 提示词编辑区 */}
          <Card className="p-3 bg-slate-50">
            <Label htmlFor="prompt" className="text-sm font-semibold mb-2 block">
              提示词模板
            </Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="输入提示词，使用 {{参数名}} 标记参数..."
              className="min-h-[200px] font-mono text-xs resize-y bg-white"
            />
          </Card>

          {/* 参数输入区 */}
          {parameters.length > 0 && (
            <Card className="p-3 bg-slate-50">
              <h2 className="text-sm font-semibold mb-2">参数设置</h2>
              <div className="space-y-3">
                {parameters.map((param, index) => (
                  <div key={index} className="space-y-1">
                    <Label
                      htmlFor={`param-${param.name}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span>{param.name}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px]">
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
                      className="h-20 bg-white text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 模型选择区 */}
          <Card className="p-3 bg-slate-50">
            <h2 className="text-sm font-semibold mb-2">选择模型（最多3个）</h2>
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
                      <Label htmlFor={model.id} className="text-xs">{model.name}</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">
                        温度: {model.temperature || 0.7}
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
                          <span className="text-xs text-gray-500">处理中...</span>
                        )}
                      </div>
                    </h3>
                    <ScrollArea className="h-[calc((100vh-20rem)/3)] w-full rounded-md border p-3">
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
                  <p className="text-sm font-semibold">暂无输出结果</p>
                  <p className="text-xs">请输入提示词并选择模型后运行</p>
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