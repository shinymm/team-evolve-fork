'use client'

import React from 'react'
import { useState, useEffect } from 'react'
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
import { setAIConfig } from '@/lib/ai-config-service'

interface AIModelConfig {
  id: string
  name: string
  baseURL: string
  model: string
  temperature: number
  apiKey: string
  isDefault: boolean
}

const presetConfigs = {
  'zhipu': { baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-flash' },
  'openai': { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
}

export const AIModelSettings = () => {
  const [configs, setConfigs] = useState<AIModelConfig[]>([])
  const [newConfig, setNewConfig] = useState<Partial<AIModelConfig>>({
    temperature: 0.2,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  useEffect(() => {
    const storedConfigs = localStorage.getItem('aiModelConfigs')
    if (storedConfigs) {
      setConfigs(JSON.parse(storedConfigs))
    }
  }, [])

  useEffect(() => {
    if (configs.length > 0) {
      localStorage.setItem('aiModelConfigs', JSON.stringify(configs))
    } else {
      localStorage.removeItem('aiModelConfigs')
    }
  }, [configs])

  const handleAddConfig = () => {
    if (newConfig.baseURL && newConfig.model && newConfig.apiKey) {
      const configToAdd = {
        ...newConfig,
        id: Date.now().toString(),
        name: `${newConfig.model} (${new Date().toLocaleString()})`,
        temperature: newConfig.temperature || 0.2,
        isDefault: configs.length === 0,
      } as AIModelConfig
      setConfigs([...configs, configToAdd])
      setNewConfig({ temperature: 0.2 })
      setShowAddForm(false)
      toast({
        title: "添加成功",
        description: "新的 AI 模型配置已添加",
        duration: 3000
      })
    }
  }

  const handleDeleteConfig = (id: string) => {
    const updatedConfigs = configs.filter(config => config.id !== id)
    if (configs.find(config => config.id === id)?.isDefault && updatedConfigs.length > 0) {
      updatedConfigs[0].isDefault = true
    }
    setConfigs(updatedConfigs)
    setTestResults(prev => {
      const newResults = { ...prev }
      delete newResults[id]
      return newResults
    })
  }

  const handleSetDefault = (id: string) => {
    const newConfigs = configs.map(config => ({
      ...config,
      isDefault: config.id === id
    }))
    setConfigs(newConfigs)
    
    const defaultConfig = newConfigs.find(config => config.id === id)
    if (defaultConfig) {
      setAIConfig({
        model: defaultConfig.model,
        apiKey: defaultConfig.apiKey,
        baseURL: defaultConfig.baseURL,
        temperature: defaultConfig.temperature
      })
      
      toast({
        title: "已更新默认配置",
        description: "AI模型配置已更新",
      })
    }
  }

  const handlePresetChange = (preset: keyof typeof presetConfigs) => {
    setNewConfig({
      ...newConfig,
      ...presetConfigs[preset],
    })
  }

  const handleTestConfig = async (config: AIModelConfig) => {
    setTestingId(config.id)
    let responseContent = ''

    try {
      console.log('Testing config:', {
        model: config.model,
        baseURL: config.baseURL,
        temperature: config.temperature
      })

      await streamingAICall(
        '这是连接测试，请简单响应', 
        {
          model: config.model,
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          temperature: config.temperature
        },
        (content: string) => {
          // console.log('Received content chunk:', content)
          responseContent += content
        }
      )

      setTestResults(prev => ({ ...prev, [config.id]: true }))
      toast({
        title: "链接测试成功",
        description: `${responseContent.slice(0, 50)}...`,
        duration: 3000
      })

    } catch (error) {
      console.error('Test config error:', error)
      setTestResults(prev => ({ ...prev, [config.id]: false }))
      toast({
        variant: "destructive",
        title: "链接测试失败",
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000
      })
    } finally {
      setTestingId(null)
    }
  }

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
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell>{config.baseURL}</TableCell>
                <TableCell>{config.model}</TableCell>
                <TableCell>{config.temperature}</TableCell>
                <TableCell>
                  <input
                    type="radio"
                    checked={config.isDefault}
                    onChange={() => handleSetDefault(config.id)}
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
                          测试链接
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteConfig(config.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 添加新配置表单 */}
      {showAddForm && (
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
                onChange={(e) => setNewConfig({ ...newConfig, baseURL: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-[120px,1fr] items-center gap-4">
              <Label htmlFor="modelName">模型名称</Label>
              <Input
                id="modelName"
                value={newConfig.model || ''}
                onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })}
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
                onChange={(e) => setNewConfig({ ...newConfig, temperature: parseFloat(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-[120px,1fr] items-center gap-4">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={newConfig.apiKey || ''}
                onChange={(e) => setNewConfig({ ...newConfig, apiKey: e.target.value })}
              />
            </div>

            <div className="mt-6 flex gap-4">
              <Button onClick={handleAddConfig}>
                添加配置
              </Button>
              <Button variant="outline" onClick={() => {
                setShowAddForm(false)
                setNewConfig({ temperature: 0.2 })
              }}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

