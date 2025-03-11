'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Trash2, Zap } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { streamingAICall } from '@/lib/ai-service'
import { cn } from '@/lib/utils'
import { useAIConfigStore } from '@/lib/stores/ai-config-store'
import type { AIModelConfig } from '@/lib/ai-service'

const presetConfigs = {
  'zhipu': { baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-flash' },
  'qwen': { baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-long' },
  'deepseek': { baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' },
  'openai': { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  'google': { baseURL: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash-lite' },
  'claude': { baseURL: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20240620' }
}

export const AIModelSettings = () => {
  // 使用选择器函数只获取需要的状态，避免不必要的重新渲染
  const configs = useAIConfigStore(state => state.configs)
  const defaultConfig = useAIConfigStore(state => state.defaultConfig)
  const addConfig = useAIConfigStore(state => state.addConfig)
  const deleteConfig = useAIConfigStore(state => state.deleteConfig)
  const setDefaultConfig = useAIConfigStore(state => state.setDefaultConfig)
  
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({
    temperature: 0.2,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  // 使用 useCallback 优化事件处理函数
  const handleAddConfig = useCallback(() => {
    if (newConfig.baseURL && newConfig.model && newConfig.apiKey) {
      addConfig({
        ...newConfig,
        name: `${newConfig.model} (${new Date().toLocaleString()})`,
      })
      setNewConfig({ temperature: 0.2 })
      setShowAddForm(false)
      toast({
        title: "添加成功",
        description: "新的 AI 模型配置已添加",
        duration: 3000
      })
    }
  }, [newConfig, addConfig, toast])

  const handleDeleteConfig = useCallback((id: string) => {
    deleteConfig(id)
    setTestResults(prev => {
      const newResults = { ...prev }
      delete newResults[id]
      return newResults
    })
  }, [deleteConfig])

  const handleSetDefault = useCallback((id: string) => {
    setDefaultConfig(id)
    
    toast({
      title: "已更新默认配置",
      description: "AI模型配置已更新",
    })
  }, [setDefaultConfig, toast])

  const handlePresetChange = useCallback((preset: keyof typeof presetConfigs) => {
    setNewConfig(prev => ({
      ...prev,
      ...presetConfigs[preset],
    }))
  }, [])

  const handleTestConfig = useCallback(async (config: AIModelConfig) => {
    setTestingId(config.id || '')
    let responseContent = ''

    try {

      await streamingAICall(
        '这是连接测试，请简单响应', 
        {
          model: config.model,
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          temperature: config.temperature
        },
        (content: string) => {
          responseContent += content
        }
      )

      setTestResults(prev => ({ ...prev, [config.id || '']: true }))
      toast({
        title: "链接测试成功",
        description: `${responseContent.slice(0, 50)}...`,
        duration: 3000
      })

    } catch (error) {
      console.error('Test config error:', error)
      setTestResults(prev => ({ ...prev, [config.id || '']: false }))
      toast({
        variant: "destructive",
        title: "链接测试失败",
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000
      })
    } finally {
      setTestingId(null)
    }
  }, [toast])

  // 使用 useMemo 缓存配置列表渲染
  const configRows = useMemo(() => {
    return configs.map((config) => (
      <TableRow key={config.id}>
        <TableCell>{config.baseURL}</TableCell>
        <TableCell>{config.model}</TableCell>
        <TableCell>{config.temperature}</TableCell>
        <TableCell>
          <input
            type="radio"
            checked={config.isDefault}
            onChange={() => handleSetDefault(config.id || '')}
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
                testResults[config.id || ''] === true && "bg-green-50 text-green-600 hover:bg-green-100",
                testResults[config.id || ''] === false && "bg-red-50 text-red-600 hover:bg-red-100"
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
                  测试链接
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteConfig(config.id || '')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ))
  }, [configs, testingId, testResults, handleSetDefault, handleTestConfig, handleDeleteConfig])

  // 使用 useMemo 缓存添加表单渲染
  const addForm = useMemo(() => {
    if (!showAddForm) return null
    
    return (
      <div className="space-y-4 border-t pt-6">
        <h2 className="text-xl font-semibold">添加新配置</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="preset">预设配置</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger id="preset">
                <SelectValue placeholder="选择预设" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zhipu">智谱</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="url">API URL</Label>
            <Input
              id="url"
              value={newConfig.baseURL || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, baseURL: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="modelName">模型名称</Label>
            <Input
              id="modelName"
              value={newConfig.model || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, model: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="temperature">温度</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={newConfig.temperature || 0.2}
              onChange={(e) => setNewConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={newConfig.apiKey || ''}
              onChange={(e) => setNewConfig(prev => ({ ...prev, apiKey: e.target.value }))}
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
      {/* 现有配置列表 */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">大模型现有配置</h2>
          <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="mr-2 h-4 w-4" /> 添加配置
          </Button>
        </div>
        
        {configs.length === 0 ? (
          <Alert>
            <AlertTitle>没有找到配置</AlertTitle>
            <AlertDescription>
              您还没有添加任何大模型配置，请点击"添加配置"按钮添加新的配置。
            </AlertDescription>
          </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>API URL</TableHead>
                <TableHead>模型名称</TableHead>
                <TableHead>温度</TableHead>
                <TableHead>默认</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configRows}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 添加新配置表单 */}
      {addForm}
    </div>
  )
}

// 导出为默认组件，以便与 React.lazy 配合使用
export default AIModelSettings

