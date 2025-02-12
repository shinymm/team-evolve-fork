'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, PlusCircle, Edit2, Check, X, Info, CheckCircle, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useProductInfo } from '@/lib/hooks/use-product-info'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { ArchitectureSuggestion } from '@/lib/services/architecture-suggestion-service'
import { updateTask, getTasks, Task } from '@/lib/services/task-service'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

export default function InformationArchitecture() {
  const {
    flatArchitecture,
    overview,
    userNeeds,
    addArchitectureItem,
    updateArchitectureItem,
    deleteArchitectureItem,
    getArchitectureTree,
    updateOverview,
    updateUserNeed
  } = useProductInfo()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(true)
  const [isEditingOverview, setIsEditingOverview] = useState(false)
  const [editingOverviewText, setEditingOverviewText] = useState('')
  const [isUserNeedsExpanded, setIsUserNeedsExpanded] = useState(true)
  const [editingUserNeedId, setEditingUserNeedId] = useState<string | null>(null)
  const [editingUserNeedForm, setEditingUserNeedForm] = useState<{
    id: string
    title: string
    features: string
    needs: string
  } | null>(null)
  const [suggestions, setSuggestions] = useState<ArchitectureSuggestion[]>([])
  const { toast } = useToast()

  useEffect(() => {
    // 从localStorage加载架构建议
    const storedSuggestions = localStorage.getItem('architecture-suggestions')
    
    if (storedSuggestions) {
      try {
        setSuggestions(JSON.parse(storedSuggestions))
      } catch (error) {
        console.error('Failed to parse architecture suggestions:', error)
      }
    }
  }, [])

  // 处理架构建议
  const handleApplySuggestions = async () => {
    try {
      // 应用所有建议
      for (const suggestion of suggestions) {
        switch (suggestion.type) {
          case 'add':
            if (suggestion.parentId && suggestion.title && suggestion.description) {
              addArchitectureItem(suggestion.title, suggestion.description, suggestion.parentId)
            }
            break
          case 'modify':
            if (suggestion.nodeId && suggestion.title && suggestion.description) {
              updateArchitectureItem(suggestion.nodeId, suggestion.title, suggestion.description)
            }
            break
          case 'delete':
            if (suggestion.nodeId) {
              deleteArchitectureItem(suggestion.nodeId)
            }
            break
        }
      }

      // 清除建议
      localStorage.removeItem('architecture-suggestions')
      setSuggestions([])

      // 更新任务状态
      const tasks = await getTasks()
      const confirmTask = tasks.find(t => t.type === 'architecture-confirm')
      if (confirmTask) {
        await updateTask(confirmTask.id, { status: 'completed' })
      }

      toast({
        title: "更新成功",
        description: "已应用所有架构调整建议",
        duration: 3000
      })
    } catch (error) {
      console.error('Failed to apply suggestions:', error)
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 折叠控制函数
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => {
    const allIds = new Set(flatArchitecture.map(item => item.id))
    setExpandedItems(allIds)
  }

  const collapseAll = () => {
    setExpandedItems(new Set())
  }

  const handleEdit = (item: { id: string; title: string; description: string }) => {
    setEditingId(item.id)
    setEditForm({ title: item.title, description: item.description })
  }

  const handleSaveEdit = (id: string) => {
    updateArchitectureItem(id, editForm.title, editForm.description)
    setEditingId(null)
  }

  const handleOverviewEdit = () => {
    setIsEditingOverview(true)
    setEditingOverviewText(overview.content)
  }

  const handleOverviewSave = () => {
    updateOverview({ ...overview, content: editingOverviewText })
    setIsEditingOverview(false)
  }

  const handleUserNeedEdit = (item: { id: string; title: string; features: string; needs: string }) => {
    setEditingUserNeedId(item.id)
    setEditingUserNeedForm({ ...item })
  }

  const handleUserNeedSave = () => {
    if (!editingUserNeedForm) return
    updateUserNeed(
      editingUserNeedForm.id,
      editingUserNeedForm.title,
      editingUserNeedForm.features,
      editingUserNeedForm.needs
    )
    setEditingUserNeedId(null)
    setEditingUserNeedForm(null)
  }

  const handleUserNeedCancel = () => {
    setEditingUserNeedId(null)
    setEditingUserNeedForm(null)
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(flatArchitecture, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `qare-architecture-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content)
        // 这里我们假设导入的数据会通过 localStorage 自动同步
        localStorage.setItem('qare-architecture', content)
        window.location.reload() // 重新加载页面以获取新数据
      } catch (error) {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleAcceptSuggestion = async (suggestion: ArchitectureSuggestion, index: number) => {
    try {
      // 根据建议类型更新架构
      switch (suggestion.type) {
        case 'add':
          if (suggestion.parentId && suggestion.title && suggestion.description) {
            addArchitectureItem(suggestion.title, suggestion.description, suggestion.parentId)
          }
          break
        case 'modify':
          if (suggestion.nodeId && suggestion.title && suggestion.description) {
            updateArchitectureItem(suggestion.nodeId, suggestion.title, suggestion.description)
            // 强制刷新架构树显示
            const updatedTree = getArchitectureTree()
            setExpandedItems(new Set(Array.from(expandedItems))) // 触发重新渲染
          }
          break
        case 'delete':
          if (suggestion.nodeId) {
            deleteArchitectureItem(suggestion.nodeId)
          }
          break
      }

      // 从建议列表中移除该建议
      const updatedSuggestions = suggestions.filter((_, i) => i !== index)
      setSuggestions(updatedSuggestions)

      // 更新 localStorage
      localStorage.setItem('architecture-suggestions', JSON.stringify(updatedSuggestions))

      // 如果没有建议了，清除原始响应并更新任务状态
      if (updatedSuggestions.length === 0) {
        // 更新任务状态
        const tasks = await getTasks()
        const confirmTask = tasks.find(t => t.type === 'architecture-confirm')
        if (confirmTask) {
          await updateTask(confirmTask.id, { status: 'completed' })
        }
      }

      toast({
        title: "已接受建议",
        description: suggestion.type === 'modify' ? "节点描述已更新" : suggestion.type === 'add' ? "新节点已添加" : "节点已删除",
        duration: 2000
      })
    } catch (error) {
      console.error('Failed to accept suggestion:', error)
      toast({
        title: "更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
        duration: 3000
      })
    }
  }

  const handleRejectSuggestion = async (index: number) => {
    // 从当前建议列表中移除
    const updatedSuggestions = suggestions.filter((_, i) => i !== index)
    setSuggestions(updatedSuggestions)

    // 更新 localStorage
    localStorage.setItem('architecture-suggestions', JSON.stringify(updatedSuggestions))

    // 如果没有建议了，更新任务状态
    if (updatedSuggestions.length === 0) {
      // 更新任务状态
      const tasks = await getTasks()
      const confirmTask = tasks.find(t => t.type === 'architecture-confirm')
      if (confirmTask) {
        await updateTask(confirmTask.id, { status: 'completed' })
      }
    }

    toast({
      title: "已拒绝建议",
      description: "该建议已被移除",
      duration: 2000
    })
  }

  const renderArchitectureItem = (item: any, level: number = 0) => {
    const isEditing = editingId === item.id
    const isExpanded = expandedItems.has(item.id)
    const hasChildren = item.children && item.children.length > 0
    const suggestion = suggestions.find(s => s.nodeId === item.id)

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit(item.id)
      } else if (e.key === 'Escape') {
        setEditingId(null)
      }
    }

    return (
      <div key={item.id} className={`ml-${level * 3}`}>
        <div className={`group hover:bg-gray-50 rounded-md ${
          suggestion?.type === 'modify' ? 'bg-orange-50' : 
          suggestion?.type === 'delete' ? 'bg-red-50' : ''
        }`}>
          <div className="flex items-center gap-1 py-1.5 px-2">
            {isEditing ? (
              <div className="flex-1 flex items-baseline gap-2">
                <div className="flex items-center gap-2 min-w-[120px]">
                  <input
                    autoFocus
                    className="w-full px-1.5 py-0.5 text-sm border rounded"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    onKeyDown={handleKeyDown}
                  />
                </div>
                <span className="text-xs text-gray-400">—</span>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    className="flex-1 px-1.5 py-0.5 text-sm border rounded"
                    value={editForm.description}
                    maxLength={30}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="p-1 hover:text-green-600 hover:bg-green-50 rounded"
                      title="保存 (Enter)"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 hover:text-red-600 hover:bg-red-50 rounded"
                      title="取消 (Esc)"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-baseline">
                  <div className="flex items-baseline min-w-[120px]">
                    {hasChildren && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(item.id)
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded mr-1"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                        )}
                      </button>
                    )}
                    <div 
                      onClick={() => handleEdit(item)}
                      className="flex-1 flex items-baseline gap-2 cursor-pointer hover:text-blue-600"
                    >
                      <h3 className="text-sm font-medium text-gray-800">{item.title}</h3>
                      <span className="text-xs text-gray-400 mx-1">—</span>
                      <p className="text-xs text-gray-600 flex-1">{item.description}</p>
                      {suggestion && (
                        <span className="text-xs text-yellow-600 ml-2">
                          {suggestion.type === 'modify' ? '建议修改' : suggestion.type === 'delete' ? '建议删除' : ''}
                        </span>
                      )}
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 ml-2 bg-white px-2 py-1 rounded-md shadow-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          addArchitectureItem("新菜单项", "请添加描述", item.id)
                        }}
                        className="p-0.5 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="添加子项"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteArchitectureItem(item.id)
                        }}
                        className="p-0.5 hover:text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {item.children && isExpanded && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 pl-3">
            {item.children.map((child: any) => renderArchitectureItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">产品信息架构</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理产品的功能架构、概述和用户需求
          </p>
        </div>
        <div className="flex gap-2">
          {suggestions.length > 0 && (
            <Button onClick={handleApplySuggestions} className="bg-orange-500 hover:bg-orange-600">
              应用信息架构调整建议 ({suggestions.length})
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>展开全部</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>折叠全部</Button>
            <Button variant="outline" size="sm" onClick={handleExport}>导出架构</Button>
            <label className="cursor-pointer">
              <Input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
              <Button variant="outline" size="sm" asChild>
                <span>导入架构</span>
              </Button>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 功能架构 */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">功能架构</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0.5">
              {getArchitectureTree().map(item => renderArchitectureItem(item))}
            </div>
          </CardContent>
        </Card>

        {/* 架构建议 */}
        {suggestions.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">架构调整建议</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <Card key={index} className={`border shadow-sm ${
                      suggestion.type === 'add' 
                        ? 'border-green-100 bg-green-50/50' 
                        : 'border-orange-100 bg-orange-50/50'
                    }`}>
                      <CardHeader className="py-2 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`
                              ${suggestion.type === 'add' 
                                ? 'border-green-200 text-green-700 bg-green-50' 
                                : 'border-orange-200 text-orange-700 bg-orange-50'
                              }
                            `}>
                              {suggestion.type === 'add' ? '新增节点' : suggestion.type === 'modify' ? '修改节点' : '删除节点'}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {suggestion.type === 'add' ? `父节点: ${suggestion.parentId}` : `节点: ${suggestion.nodeId}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-gray-600 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleRejectSuggestion(index)}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                拒绝
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
                                onClick={() => handleAcceptSuggestion(suggestion, index)}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                接受
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2 px-4">
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-gray-600">标题：</span>
                            <span className="text-sm text-gray-700">{suggestion.title}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-gray-600">描述：</span>
                            <span className="text-sm text-gray-700">{suggestion.description}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* 产品概述 */}
        <Card>
          <CardHeader
            className="py-3 cursor-pointer"
            onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">产品概述</CardTitle>
                {isOverviewExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </div>
              {isOverviewExpanded && !isEditingOverview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOverviewEdit()
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          {isOverviewExpanded && (
            <CardContent className="pt-0">
              {isEditingOverview ? (
                <div className="space-y-2">
                  <Textarea
                    value={editingOverviewText}
                    onChange={(e) => setEditingOverviewText(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingOverview(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleOverviewSave}
                    >
                      保存
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {overview.content}
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* 用户需求 */}
        <Card>
          <CardHeader
            className="py-3 cursor-pointer"
            onClick={() => setIsUserNeedsExpanded(!isUserNeedsExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">用户需求</CardTitle>
                {isUserNeedsExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </div>
            </div>
          </CardHeader>
          {isUserNeedsExpanded && (
            <CardContent className="pt-0">
              <div className="space-y-4">
                {userNeeds.items.map(item => (
                  <div key={item.id} className="space-y-2">
                    {editingUserNeedId === item.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">用户群体</label>
                          <Input
                            value={editingUserNeedForm?.title}
                            onChange={(e) => setEditingUserNeedForm(prev => prev ? { ...prev, title: e.target.value } : null)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">特征描述</label>
                          <Textarea
                            value={editingUserNeedForm?.features}
                            onChange={(e) => setEditingUserNeedForm(prev => prev ? { ...prev, features: e.target.value } : null)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">核心需求</label>
                          <Textarea
                            value={editingUserNeedForm?.needs}
                            onChange={(e) => setEditingUserNeedForm(prev => prev ? { ...prev, needs: e.target.value } : null)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUserNeedCancel}
                          >
                            取消
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleUserNeedSave}
                          >
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="group">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium">{item.title}</h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUserNeedEdit(item)}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{item.features}</p>
                        <p className="mt-1 text-sm text-gray-600">{item.needs}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
      <Toaster />
    </div>
  )
} 