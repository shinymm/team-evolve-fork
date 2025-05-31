'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Edit2, Check, Trash2, Plus, Download, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSystemStore } from '@/lib/stores/system-store'
import { useRouter } from 'next/navigation'
import type { ArchitectureItem, UserPersona, ProductInfo, ArchitectureSuggestion } from '@/types/product-info'
import { useTranslations } from 'next-intl'

export default function InformationArchitecture() {
  const t = useTranslations('InformationArchitecture')
  const router = useRouter()
  const { selectedSystemId } = useSystemStore()
  const [loading, setLoading] = useState(true)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(true)
  const [isEditingOverview, setIsEditingOverview] = useState(false)
  const [editingOverviewText, setEditingOverviewText] = useState('')
  const [isUserNeedsExpanded, setIsUserNeedsExpanded] = useState(true)
  const [editingUserNeedId, setEditingUserNeedId] = useState<string | null>(null)
  const [editingUserNeedForm, setEditingUserNeedForm] = useState<UserPersona | null>(null)
  const [suggestions, setSuggestions] = useState<ArchitectureSuggestion[]>([])
  const { toast } = useToast()
  const [isAddingPersona, setIsAddingPersona] = useState(false)

  // 将扁平结构转换为树状结构
  const buildTree = (items: ArchitectureItem[]): ArchitectureItem[] => {
    const itemMap = new Map<string, ArchitectureItem>()
    const rootItems: ArchitectureItem[] = []

    // 首先创建所有节点的映射，确保保留原始的 parentId
    items.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] })
    })

    // 构建树状结构
    items.forEach(item => {
      if (item.parentId && itemMap.has(item.parentId)) {
        // 如果有父节点，添加到父节点的 children 中
        const parent = itemMap.get(item.parentId)!
        parent.children = parent.children || []
        parent.children.push(itemMap.get(item.id)!)
      } else {
        // 如果没有父节点或父节点不存在，作为根节点
        rootItems.push(itemMap.get(item.id)!)
      }
    })
    return rootItems
  }

  // 加载产品信息
  useEffect(() => {
    if (!selectedSystemId) {
      toast({
        title: t('selectSystem'),
        description: t('selectSystemDesc'),
        variant: "destructive"
      })
      return
    }

    const fetchProductInfo = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/systems/${selectedSystemId}/product-info`)
        if (!response.ok) {
          throw new Error(t('fetchFailed'))
        }
        const data = await response.json()
        
        // 将扁平结构转换为树状结构
        const treeData = {
          ...data,
          architecture: buildTree(data.architecture)
        }
        
        console.log('Initial tree data:', treeData.architecture)
        setProductInfo(treeData)
        
        // 修改：默认不展开任何节点，而是保持折叠状态
        setExpandedItems(new Set())
        
        setEditingOverviewText(data.overview || '')
      } catch (error) {
        console.error('获取产品信息失败:', error)
        toast({
          title: t('fetchFailed'),
          description: error instanceof Error ? error.message : t('fetchFailed'),
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchProductInfo()
  }, [selectedSystemId, toast, t])

  // 更新产品信息
  const updateProductInfo = async (data: Partial<ProductInfo>) => {
    if (!selectedSystemId || !productInfo) return

    try {
      console.log('Updating product info:', data)
      const response = await fetch(`/api/systems/${selectedSystemId}/product-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...productInfo,
          ...data,
          // 如果更新的是架构，需要将树状结构转换回扁平结构
          architecture: data.architecture ? getFlatArchitecture(data.architecture) : getFlatArchitecture(productInfo.architecture)
        })
      })

      if (!response.ok) {
        throw new Error(t('updateFailed'))
      }

      const updatedData = await response.json()
      console.log('Updated product info:', updatedData)
      
      // 确保数据是最新的
      const latestData = await fetch(`/api/systems/${selectedSystemId}/product-info`).then(res => res.json())
      console.log('Latest data from server:', latestData)
      
      // 将返回的扁平结构转换为树状结构
      const treeData = {
        ...latestData,
        architecture: buildTree(latestData.architecture)
      }
      
      // 强制更新状态
      setProductInfo(null) // 先清空状态
      setTimeout(() => {
        setProductInfo(treeData) // 然后设置新状态
      }, 0)
      
      toast({
        title: t('updateSuccess'),
        description: t('updateSuccessDesc'),
        duration: 2000
      })
    } catch (error) {
      console.error('更新产品信息失败:', error)
      toast({
        title: t('updateFailed'),
        description: error instanceof Error ? error.message : t('updateFailed'),
        variant: "destructive"
      })
      throw error
    }
  }

  // 获取扁平化的架构列表
  const getFlatArchitecture = (items: ArchitectureItem[]): ArchitectureItem[] => {
    const result: ArchitectureItem[] = []
    
    const flatten = (item: ArchitectureItem) => {
      // 创建一个不包含 children 的新对象，但保留 parentId
      const flatItem = {
        id: item.id,
        title: item.title,
        description: item.description,
        parentId: item.parentId // 保持原有的 parentId
      }
      result.push(flatItem)
      
      // 递归处理子节点，确保设置正确的 parentId
      if (item.children && item.children.length > 0) {
        item.children.forEach(child => {
          // 确保子节点有正确的 parentId
          child.parentId = item.id
          flatten(child)
        })
      }
    }
    
    items.forEach(item => flatten(item))
    return result
  }

  // 处理架构建议
  const handleSuggestion = async (suggestion: ArchitectureSuggestion) => {
    if (!productInfo) return

    let updatedArchitecture = [...productInfo.architecture]
    
    switch (suggestion.action) {
      case 'add':
        const newItem = {
          id: suggestion.targetId || suggestion.id,
          title: suggestion.title,
          description: suggestion.description,
          children: []
        }
        
        if (suggestion.parentId) {
          // 添加到指定父节点
          updatedArchitecture = addToParent(updatedArchitecture, suggestion.parentId, newItem)
        } else {
          // 添加到根级别
          updatedArchitecture.push(newItem)
        }
        break
        
      case 'update':
        if (suggestion.targetId) {
          updatedArchitecture = updateNode(
            updatedArchitecture,
            suggestion.targetId,
            suggestion.title,
            suggestion.description
          )
        }
        break
        
      case 'delete':
        if (suggestion.targetId) {
          updatedArchitecture = deleteNode(updatedArchitecture, suggestion.targetId)
        }
        break
    }
    
    await updateProductInfo({ architecture: updatedArchitecture })
    
    // 从建议列表中移除
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
    
    // 保存更新后的建议到localStorage
    localStorage.setItem('architecture-suggestions', JSON.stringify(
      suggestions.filter(s => s.id !== suggestion.id)
    ))
  }

  // 处理应用建议
  const handleApplySuggestion = async (suggestion: ArchitectureSuggestion, index: number) => {
    try {
      await handleSuggestion(suggestion)
      
      toast({
        title: t('updateSuccess'),
        description: t('updateSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Failed to apply suggestion:', error)
      toast({
        title: t('updateFailed'),
        description: error instanceof Error ? error.message : t('updateFailed'),
        variant: "destructive",
        duration: 3000
      })
    }
  }

  // 辅助函数：添加到父节点
  const addToParent = (items: ArchitectureItem[], parentId: string, newItem: ArchitectureItem): ArchitectureItem[] => {
    return items.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          children: [...(item.children || []), newItem]
        }
      }
      if (item.children) {
        return {
          ...item,
          children: addToParent(item.children, parentId, newItem)
        }
      }
      return item
    })
  }

  // 辅助函数：更新节点
  const updateNode = (items: ArchitectureItem[], id: string, title: string, description: string): ArchitectureItem[] => {
    return items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          title,
          description
        }
      }
      if (item.children) {
        return {
          ...item,
          children: updateNode(item.children, id, title, description)
        }
      }
      return item
    })
  }

  // 辅助函数：删除节点
  const deleteNode = (items: ArchitectureItem[], id: string): ArchitectureItem[] => {
    return items.filter(item => {
      if (item.id === id) {
        return false
      }
      if (item.children) {
        item.children = deleteNode(item.children, id)
      }
      return true
    })
  }

  // 展开全部
  const expandAll = () => {
    if (!productInfo?.architecture) return
    const allIds = new Set<string>()
    
    const collectIds = (items: ArchitectureItem[]) => {
      items.forEach(item => {
        allIds.add(item.id)
        if (item.children?.length) {
          collectIds(item.children)
        }
      })
    }
    
    collectIds(productInfo.architecture)
    console.log('Expanding all items:', allIds)
    setExpandedItems(allIds)
  }

  // 折叠全部
  const collapseAll = () => {
    console.log('Collapsing all items')
    setExpandedItems(new Set())
  }

  // 处理展开/折叠
  const toggleExpand = (item: ArchitectureItem) => {
    console.log('Toggling item:', item.id, 'Current expanded:', expandedItems)
    const newExpandedItems = new Set(expandedItems)
    if (expandedItems.has(item.id)) {
      newExpandedItems.delete(item.id)
    } else {
      newExpandedItems.add(item.id)
    }
    console.log('New expanded items:', newExpandedItems)
    setExpandedItems(newExpandedItems)
  }

  // 处理编辑
  const handleEdit = (item: { id: string; title: string; description: string }) => {
    setEditingId(item.id)
    setEditForm({ title: item.title, description: item.description })
  }

  // 处理保存编辑
  const handleSaveEdit = async (id: string) => {
    if (!productInfo) return
    
    const updateTreeNode = (items: ArchitectureItem[]): ArchitectureItem[] => {
      return items.map(item => {
        if (item.id === id) {
          // 保留原有的 parentId 和 children
          return {
            ...item,
            ...editForm,
            parentId: item.parentId, // 确保保留 parentId
            children: item.children // 确保保留 children
          }
        }
        if (item.children) {
          return {
            ...item,
            children: updateTreeNode(item.children)
          }
        }
        return item
      })
    }
    
    const updatedArchitecture = updateTreeNode(productInfo.architecture)
    await updateProductInfo({ architecture: updatedArchitecture })
    setEditingId(null)
  }

  // 处理概述编辑
  const handleOverviewEdit = () => {
    setIsEditingOverview(true)
    setEditingOverviewText(productInfo?.overview || '')
  }

  // 处理概述保存
  const handleOverviewSave = async () => {
    await updateProductInfo({ overview: editingOverviewText })
    setIsEditingOverview(false)
  }

  // 处理用户需求编辑
  const handleUserNeedEdit = (item: UserPersona) => {
    console.log('Editing user persona:', item.id)
    setEditingUserNeedId(item.id)
    setEditingUserNeedForm({
      id: item.id,
      title: item.title,
      features: item.features,
      needs: item.needs
    })
  }

  // 处理用户需求保存
  const handleUserNeedSave = async () => {
    if (!editingUserNeedForm || !productInfo) return

    try {
      const updatedUserNeeds = productInfo.userPersona.map(item =>
        item.id === editingUserNeedId ? editingUserNeedForm : item
      )

      await updateProductInfo({
        ...productInfo,
        userPersona: updatedUserNeeds
      })

      setEditingUserNeedId(null)
      setEditingUserNeedForm(null)
    } catch (error) {
      console.error('Failed to save user persona:', error)
      toast({
        title: t('saveFailed'),
        description: t('saveFailedDesc'),
        variant: "destructive"
      })
    }
  }

  // 处理用户需求取消
  const handleUserNeedCancel = () => {
    setEditingUserNeedId(null)
    setEditingUserNeedForm(null)
  }

  // 渲染架构项
  const renderArchitectureItem = (item: ArchitectureItem, level: number = 0) => {
    const isEditing = editingId === item.id
    const isExpanded = expandedItems.has(item.id)
    const hasChildren = item.children && item.children.length > 0
    const suggestion = suggestions.find(s => s.targetId === item.id)

    return (
      <div key={item.id} style={{ marginLeft: `${level * 16}px` }}>
        <div className={`flex items-center py-1.5 group hover:bg-gray-50 ${
          suggestion?.action === 'update' ? 'bg-orange-50' : 
          suggestion?.action === 'delete' ? 'bg-red-50' : ''
        }`}>
          <div className="flex items-center flex-1 min-w-0 text-sm">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item)}
                className="p-0.5 hover:bg-gray-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}
            
            {isEditing ? (
              <div className="flex items-center min-w-0 gap-2 ml-1">
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="h-8 text-sm w-[120px]"
                  placeholder="标题"
                />
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="h-8 text-sm flex-1"
                  style={{ minWidth: `${Math.max(editForm.description.length * 10 + 150, 200)}px` }}
                  placeholder="描述"
                />
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                    className="h-8 px-2 text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(item.id)}
                    className="h-8 px-2 text-sm"
                  >
                    {t('save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center min-w-0 gap-2 ml-1 flex-1">
                <div className="flex items-center gap-2 min-w-0 group/item">
                  <span className="font-medium text-sm whitespace-nowrap">{item.title}</span>
                  {item.description && (
                    <span className="text-sm text-gray-600 truncate">
                      - {item.description}
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="h-6 px-1.5"
                      title={t('edit')}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!productInfo) return
                        try {
                          const newItem = {
                            id: String(new Date().getTime()),
                            title: '新节点',
                            description: '',
                            parentId: item.id,
                            children: []
                          }
                          
                          // 在当前节点下添加子节点
                          const updatedArchitecture = addToParent(
                            [...productInfo.architecture],
                            item.id,
                            newItem
                          )
                          
                          await updateProductInfo({ architecture: updatedArchitecture })
                          
                          // 展开父节点
                          setExpandedItems(prev => new Set([...prev, item.id]))
                          
                          // 添加后立即进入编辑状态
                          setEditingId(newItem.id)
                          setEditForm({ title: newItem.title, description: '' })
                          
                          toast({
                            title: t('addSuccess'),
                            description: t('addSuccessDesc'),
                            duration: 2000
                          })
                        } catch (error) {
                          console.error('添加子节点失败:', error)
                          toast({
                            title: t('addFailed'),
                            description: t('addFailedDesc'),
                            variant: "destructive"
                          })
                        }
                      }}
                      className="h-6 px-1.5"
                      title={t('addSubnode')}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!productInfo) return
                        try {
                          // 构建没有这个节点（及其子节点）的新架构树
                          const deleteNodeAndChildren = (items: ArchitectureItem[]): ArchitectureItem[] => {
                            return items.filter(i => {
                              if (i.id === item.id) return false
                              if (i.children) {
                                i.children = deleteNodeAndChildren(i.children)
                              }
                              return true
                            })
                          }
                          
                          const updatedArchitecture = deleteNodeAndChildren([...productInfo.architecture])
                          await updateProductInfo({ architecture: updatedArchitecture })
                          
                          toast({
                            title: t('deleteSuccess'),
                            description: t('deleteSuccessDesc'),
                            duration: 2000
                          })
                        } catch (error) {
                          console.error('删除节点失败:', error)
                          toast({
                            title: t('deleteFailed'),
                            description: t('deleteFailedDesc'),
                            variant: "destructive"
                          })
                        }
                      }}
                      className="h-6 px-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {suggestion && (
                  <span className="text-sm text-yellow-600 ml-2">
                    {suggestion.action === 'update' ? t('suggestUpdate') : suggestion.action === 'delete' ? t('suggestDelete') : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map(child => renderArchitectureItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  // 渲染用户画像
  const renderUserPersona = (item: UserPersona) => {
    const isEditing = editingUserNeedId === item.id
    
    return (
      <div className="border rounded-lg p-4">
        {isEditing ? (
          <div className="space-y-2">
            <Input
              value={editingUserNeedForm?.title || ''}
              onChange={(e) => setEditingUserNeedForm(prev => ({ ...prev!, title: e.target.value }))}
              placeholder={t('userType')}
              className="text-base h-8"
            />
            <Textarea
              value={editingUserNeedForm?.features || ''}
              onChange={(e) => setEditingUserNeedForm(prev => ({ ...prev!, features: e.target.value }))}
              placeholder={t('featureDescription')}
              className="text-base min-h-[80px] leading-6"
            />
            <Textarea
              value={editingUserNeedForm?.needs || ''}
              onChange={(e) => setEditingUserNeedForm(prev => ({ ...prev!, needs: e.target.value }))}
              placeholder={t('needDescription')}
              className="text-base min-h-[80px] leading-6"
            />
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUserNeedCancel}
                className="h-8 px-3 text-sm"
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleUserNeedSave}
                className="h-8 px-3 text-sm"
              >
                {t('save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{item.title}</h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUserNeedEdit(item)}
                  className="h-7 px-2"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!productInfo) return
                    try {
                      await updateProductInfo({
                        userPersona: productInfo.userPersona.filter(p => p.id !== item.id)
                      })
                    } catch (error) {
                      console.error('Failed to delete persona:', error)
                    }
                  }}
                  className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-gray-500 font-medium">{t('userFeature')}:</div>
              <div className="text-base leading-6">
                <p className="text-gray-600 whitespace-pre-wrap">{item.features}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-gray-500 font-medium">{t('userNeed')}:</div>
              <div className="text-base leading-6">
                <p className="text-gray-600 whitespace-pre-wrap">{item.needs}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 渲染建议列表
  const renderSuggestions = () => {
    if (!suggestions.length) return null

    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">{t('architectureAdjustment')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-5">
              {suggestions.map((suggestion, index) => (
                <Card key={suggestion.id || index} className={`border shadow-sm ${
                  suggestion.action === 'add' 
                    ? 'border-green-100 bg-green-50/50' 
                    : 'border-orange-100 bg-orange-50/50'
                }`}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`
                          ${suggestion.action === 'add' 
                            ? 'border-green-200 text-green-700 bg-green-50' 
                            : 'border-orange-200 text-orange-700 bg-orange-50'
                          }
                        `}>
                          {suggestion.action === 'add' ? t('addNode') : suggestion.action === 'update' ? t('updateNode') : t('deleteNode')}
                        </Badge>
                        <span className="text-sm text-gray-600 ml-2">
                          {suggestion.action === 'add' ? `父节点: ${suggestion.parentId}` : `节点: ${suggestion.targetId}`}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-base">{suggestion.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 leading-6">{suggestion.description}</p>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
                          onClick={() => handleApplySuggestion(suggestion, index)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          {t('apply')}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )
  }

  // 处理导出
  const handleExport = () => {
    if (!productInfo?.architecture) return
    
    const jsonStr = JSON.stringify(productInfo.architecture, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `architecture-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: t('exportSuccess'),
      description: t('exportSuccessDesc'),
      duration: 2000
    })
  }

  // 处理导入
  const handleImportArchitecture = async (jsonContent: string) => {
    try {
      // 预处理输入内容，移除可能的代码块标记
      const cleanedContent = jsonContent
        .replace(/^```(?:json)?\n/, '') // 移除开头的 ```json 或 ``` 
        .replace(/\n```$/, '')          // 移除结尾的 ```
        .trim();                        // 移除首尾空白

      const importedData = JSON.parse(cleanedContent);
      
      // 验证导入的数据结构
      if (!Array.isArray(importedData)) {
        throw new Error(t('importFormatError'))
      }

      // 更新架构
      await updateProductInfo({ architecture: importedData });
      
      toast({
        title: t('importSuccess'),
        description: t('importSuccessDesc'),
        duration: 2000
      });
    } catch (error) {
      console.error('导入失败:', error);
      toast({
        title: t('importFailed'),
        description: error instanceof Error ? error.message : t('importFailed'),
        variant: "destructive"
      });
    }
  };

  if (!selectedSystemId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-700">{t('selectSystem')}</h2>
          <p className="mt-2 text-base text-gray-500">{t('selectSystemDesc')}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-700">{t('loading')}</h2>
          <p className="mt-2 text-base text-gray-500">{t('loadingDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[90%] mx-auto py-4">
      <div className="space-y-8">
        {/* 1) 产品概述 Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">{t('productOverview')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOverviewEdit}
                disabled={isEditingOverview}
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                {productInfo?.overview ? t('edit') : t('add')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isEditingOverview ? (
              <div className="space-y-4">
                <textarea
                  className="w-full h-32 p-3 border rounded-md text-base leading-6"
                  value={editingOverviewText}
                  onChange={(e) => setEditingOverviewText(e.target.value)}
                  placeholder={t('enterProductOverview')}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingOverview(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleOverviewSave}
                  >
                    {t('save')}
                  </Button>
                </div>
              </div>
            ) : (
              productInfo?.overview ? (
                <p className="text-base text-gray-600 whitespace-pre-wrap leading-6">
                  {productInfo.overview}
                </p>
              ) : (
                <div className="text-center py-6">
                  <p className="text-base text-gray-500">{t('noProductOverview')}</p>
                  <p className="text-base text-gray-400 mt-2">{t('clickAddButton')}</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* 2) User Persona Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">{t('userPersona')}</CardTitle>
              <Button
                size="sm"
                onClick={async () => {
                  if (!productInfo) return
                  try {
                    setIsAddingPersona(true)
                    const newPersona = {
                      id: String(new Date().getTime()),
                      title: '新用户画像',
                      features: '',
                      needs: ''
                    }
                    
                    await updateProductInfo({
                      userPersona: [...(productInfo.userPersona || []), newPersona]
                    })
                    
                    // 新增后立即进入编辑状态
                    setEditingUserNeedId(newPersona.id)
                    setEditingUserNeedForm(newPersona)
                  } catch (error) {
                    console.error('Failed to add new persona:', error)
                    toast({
                      title: t('addFailed'),
                      description: t('addFailedDesc'),
                      variant: "destructive"
                    })
                  } finally {
                    setIsAddingPersona(false)
                  }
                }}
                className="h-7"
                disabled={isAddingPersona}
              >
                {isAddingPersona ? (
                  <>
                    <span className="animate-spin mr-1">⏳</span>
                    {t('adding')}...
                  </>
                ) : (
                  t('addPersona')
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {productInfo?.userPersona && productInfo.userPersona.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {productInfo.userPersona.map((item, index) => (
                  <div key={item.id || `persona-${index}`}>
                    {renderUserPersona(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-base text-gray-500">{t('noUserPersona')}</p>
                <p className="text-base text-gray-400 mt-2">{t('clickAddButton')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3) Architecture Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">{t('informationArchitecture')}</CardTitle>
              <div className="flex gap-2">
                {(productInfo?.architecture ?? []).length > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={expandAll}
                      className="text-xs h-7"
                    >
                      {t('expandAll')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={collapseAll}
                      className="text-xs h-7"
                    >
                      {t('collapseAll')}
                    </Button>
                  </>
                )}
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      try {
                        const text = await file.text();
                        await handleImportArchitecture(text);
                      } catch (error) {
                        console.error('读取文件失败:', error);
                        toast({
                          title: t('readFailed'),
                          description: t('readFailedDesc'),
                          variant: "destructive"
                        });
                      }
                      
                      // 清除 input 的值，允许重复导入同一个文件
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="import-architecture-file"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById('import-architecture-file')?.click()}
                    className="text-xs h-7"
                    title={t('importFromJSON')}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {t('import')}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="text-xs h-7"
                  title={t('exportToJSON')}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  {t('export')}
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!productInfo) return
                    try {
                      const newItem = {
                        id: String(new Date().getTime()),
                        title: '新节点',
                        description: '',
                        children: []
                      }
                      await updateProductInfo({
                        architecture: [...(productInfo.architecture || []), newItem]
                      })
                      // 添加后立即进入编辑状态
                      setEditingId(newItem.id)
                      setEditForm({ title: newItem.title, description: '' })
                    } catch (error) {
                      console.error('添加节点失败:', error)
                      toast({
                        title: t('addFailed'),
                        description: t('addFailedDesc'),
                        variant: "destructive"
                      })
                    }
                  }}
                  className="text-xs h-7"
                >
                  {t('addNode')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {productInfo?.architecture && productInfo.architecture.length > 0 ? (
              <div className="space-y-0">
                {productInfo.architecture.map((item, index) => (
                  <div key={item.id || `arch-${index}`}>
                    {renderArchitectureItem(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-base text-gray-500">{t('noInformationArchitecture')}</p>
                <p className="text-base text-gray-400 mt-2">{t('clickAddButton')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggestions Section */}
        {renderSuggestions()}
      </div>
    </div>
  )
} 