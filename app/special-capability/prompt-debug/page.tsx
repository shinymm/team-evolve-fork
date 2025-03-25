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

export default function PromptDebugPage() {
  const [prompt, setPrompt] = useState<string>('')
  const [parameters, setParameters] = useState<Parameter[]>([])
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [outputs, setOutputs] = useState<ModelOutput[]>([])
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

  return (
    <div className="mx-auto py-6 w-[90%]">
      <h1 className="text-2xl font-bold">提示词调试</h1>
      
      {/* 提示词编辑区 */}
      <Card className="p-4">
        <Label htmlFor="prompt">提示词模板</Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入提示词，使用 {{参数名}} 标记参数..."
          className="min-h-[200px] font-mono"
        />
      </Card>

      {/* 参数输入区 */}
      {parameters.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">参数设置</h2>
          <div className="grid gap-4">
            {parameters.map((param, index) => (
              <div key={index} className="grid gap-2">
                <Label htmlFor={`param-${param.name}`}>{param.name}</Label>
                <Textarea
                  id={`param-${param.name}`}
                  value={param.value}
                  onChange={(e) => {
                    const newParams = [...parameters]
                    newParams[index].value = e.target.value
                    setParameters(newParams)
                  }}
                  className="h-24"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 模型选择区 */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">选择模型（最多3个）</h2>
        <div className="grid gap-4">
          {availableModels.map((model) => (
            <div key={model.id} className="flex items-center space-x-2">
              <Checkbox
                id={model.id}
                checked={selectedModels.includes(model.id)}
                onCheckedChange={() => handleModelSelect(model.id)}
                disabled={!selectedModels.includes(model.id) && selectedModels.length >= 3}
              />
              <Label htmlFor={model.id}>{model.name}</Label>
            </div>
          ))}
        </div>
      </Card>

      {/* 运行按钮 */}
      <div className="flex justify-center">
        <Button
          onClick={runPrompt}
          disabled={selectedModels.length === 0 || !prompt.trim()}
          size="lg"
        >
          运行
        </Button>
      </div>

      {/* 输出结果区 */}
      {outputs.length > 0 && (
        <div className={`grid gap-4 ${outputs.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {outputs.map((output) => (
            <Card key={output.modelId} className="p-4">
              <h3 className="text-lg font-semibold mb-2">
                {availableModels.find(m => m.id === output.modelId)?.name}
              </h3>
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                {output.loading ? (
                  <div className="animate-pulse">加载中...</div>
                ) : (
                  <pre className="whitespace-pre-wrap">{output.content}</pre>
                )}
              </ScrollArea>
            </Card>
          ))}
        </div>
      )}

      <Toaster />
    </div>
  )
} 