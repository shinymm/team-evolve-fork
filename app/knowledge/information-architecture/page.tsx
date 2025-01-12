'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, PlusCircle, Settings, Trash2, Edit2, Check, X } from 'lucide-react'

interface ArchitectureItem {
  id: string
  title: string
  description: string
  parentId?: string
}

const initialArchitecture: ArchitectureItem[] = [

        { "id": "1", "title": "知识引擎", "description": "支持意图管理、知识管理、脚本维护及更新记录等功能模块" },
        { "id": "1-1", "parentId": "1", "title": "意图", "description": "支持用户和系统意图的管理与识别" },
        { "id": "1-2", "parentId": "1", "title": "实体", "description": "用户或系统数据的结构化实体定义和管理" },
        { "id": "1-3", "parentId": "1", "title": "闲聊", "description": "提供系统与用户之间的非任务型对话能力" },
        { "id": "1-4", "parentId": "1", "title": "剧本", "description": "设计对话流程与任务剧本的模块" },
        { "id": "1-5", "parentId": "1", "title": "表格/知识图谱", "description": "用于定义和展示知识表格及知识图谱" },
        { "id": "1-6", "parentId": "1", "title": "知识分享", "description": "支持知识共享与协同的功能" },
        { "id": "1-7", "parentId": "1", "title": "更新记录", "description": "对知识和意图变更的记录管理" },
      
        { "id": "2", "title": "机器人管理", "description": "包含机器人创建、配置、部署等生命周期管理功能" },
        { "id": "2-1", "parentId": "2", "title": "机器人创建", "description": "支持文本、外呼、语音和agent类型机器人的创建" },
        { "id": "2-2", "parentId": "2", "title": "机器人配置", "description": "包括知识、脚本、全局异常及模型相关参数配置" },
        { "id": "2-3", "parentId": "2", "title": "机器人部署", "description": "机器人上下线的管理" },
      
        { "id": "3", "title": "文档管理（RAG）", "description": "支持文档上传、删除和检索等功能" },
        { "id": "3-1", "parentId": "3", "title": "上传/删除", "description": "提供文档的上传与删除管理" },
        { "id": "3-2", "parentId": "3", "title": "搜索", "description": "通过文档内容检索相关信息" },
      
        { "id": "4", "title": "模型训练", "description": "支持从数据集到模型的完整训练管理" },
        { "id": "4-1", "parentId": "4", "title": "数据集管理", "description": "对模型训练所需的数据集进行管理" },
        { "id": "4-2", "parentId": "4", "title": "训练集/测试集", "description": "训练和测试数据的管理模块" },
        { "id": "4-3", "parentId": "4", "title": "意图分类", "description": "支持意图数据的分类与整理" },
        { "id": "4-4", "parentId": "4", "title": "推荐相似问题", "description": "提供问题相似度分析与推荐功能" },
      
        { "id": "5", "title": "语音产品", "description": "面向语音外呼和TTS功能的管理模块" },
        { "id": "5-1", "parentId": "5", "title": "智能外呼", "description": "语音外呼任务的创建与管理" },
        { "id": "5-2", "parentId": "5", "title": "外呼任务", "description": "外呼任务的策略配置和执行监控" },
        { "id": "5-3", "parentId": "5", "title": "录音中心", "description": "支持录音上传、下线、发布等管理" },
        { "id": "5-4", "parentId": "5", "title": "TTS语音合成引擎", "description": "语音合成和情感表达相关功能" },
      
        { "id": "6", "title": "运营工具", "description": "包含效果评测、测试集管理、巡检任务等功能模块" },
        { "id": "6-1", "parentId": "6", "title": "效果评测", "description": "提供对对话效果的测评能力" },
        { "id": "6-2", "parentId": "6", "title": "巡检任务", "description": "任务完成后的数据巡检工具" },
        { "id": "6-3", "parentId": "6", "title": "聚类", "description": "对对话和数据进行聚类分析" },
        { "id": "6-4", "parentId": "6", "title": "标注", "description": "支持会话和消息的标注与质量检测" },
      
        { "id": "7", "title": "数据看板", "description": "提供实时数据的可视化展示功能" },
        { "id": "7-1", "parentId": "7", "title": "数据概览", "description": "展示核心数据的总览信息" },
        { "id": "7-2", "parentId": "7", "title": "会话纬度", "description": "从会话角度展示数据统计" },
        { "id": "7-3", "parentId": "7", "title": "意图纬度", "description": "以意图为核心展示相关数据" },
      
        { "id": "8", "title": "系统监控", "description": "负责系统模型、资源、任务和数据的监控与预警" },
        { "id": "8-1", "parentId": "8", "title": "模型监控", "description": "对模型训练和使用情况的监控" },
        { "id": "8-2", "parentId": "8", "title": "任务监控", "description": "对任务执行状态的监控" },
        { "id": "8-3", "parentId": "8", "title": "数据监控", "description": "提供数据使用与变化的监控能力" }
      
      
]

export default function InformationArchitecture() {
  const [flatArchitecture, setFlatArchitecture] = useState<ArchitectureItem[]>(initialArchitecture)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const generateId = (parentId?: string) => {
    const timestamp = new Date().getTime()
    return parentId ? `${parentId}-${timestamp}` : `${timestamp}`
  }

  // 将扁平结构转换为树形结构
  const buildTree = (items: ArchitectureItem[]): ArchitectureItem[] => {
    const itemMap = new Map<string, ArchitectureItem & { children?: ArchitectureItem[] }>()
    const result: (ArchitectureItem & { children?: ArchitectureItem[] })[] = []

    // 首先创建所有节点的映射
    items.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] })
    })

    // 构建树形结构
    items.forEach(item => {
      const node = itemMap.get(item.id)!
      if (item.parentId) {
        const parent = itemMap.get(item.parentId)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        }
      } else {
        result.push(node)
      }
    })

    return result
  }

  // 将树形结构转换回扁平结构
  const flattenTree = (items: ArchitectureItem[]): ArchitectureItem[] => {
    const result: ArchitectureItem[] = []
    const flatten = (item: ArchitectureItem, parentId?: string) => {
      const flatItem = {
        id: item.id,
        title: item.title,
        description: item.description,
        parentId
      }
      result.push(flatItem)
      if ('children' in item && item.children) {
        item.children.forEach(child => flatten(child, item.id))
      }
    }
    items.forEach(item => flatten(item))
    return result
  }

  const saveToLocalStorage = (data: ArchitectureItem[]) => {
    try {
      localStorage.setItem('qare-architecture', JSON.stringify(data))
    } catch (error) {
      console.error('Error saving architecture data:', error)
    }
  }

  const handleAdd = (parentId?: string) => {
    const newItem: ArchitectureItem = {
      id: generateId(parentId),
      title: "新菜单项",
      description: "请添加描述",
      parentId
    }
    setFlatArchitecture(prev => {
      const newData = [...prev, newItem]
      saveToLocalStorage(newData)
      return newData
    })
  }

  const handleDelete = (id: string) => {
    setFlatArchitecture(prev => 
      prev.filter(item => item.id !== id && item.parentId !== id)
    )
  }

  const handleSaveEdit = (id: string) => {
    setFlatArchitecture(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, title: editForm.title, description: editForm.description }
          : item
      )
    )
    setEditingId(null)
  }

  // 添加折叠控制函数
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

  // 渲染时使用树形结构
  const renderArchitecture = () => {
    const tree = buildTree(flatArchitecture)
    return tree.map(item => renderArchitectureItem(item))
  }

  const handleEdit = (item: ArchitectureItem) => {
    setEditingId(item.id)
    setEditForm({ title: item.title, description: item.description })
  }

  const renderArchitectureItem = (item: ArchitectureItem, level: number = 0) => {
    const isEditing = editingId === item.id
    const isExpanded = expandedItems.has(item.id)
    const hasChildren = item.children && item.children.length > 0

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveEdit(item.id)
      } else if (e.key === 'Escape') {
        setEditingId(null)
      }
    }

    return (
      <div key={item.id} className={`ml-${level * 3}`}>
        <div className="group hover:bg-gray-50 rounded-md">
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
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 ml-2 bg-white px-2 py-1 rounded-md shadow-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAdd(item.id)
                        }}
                        className="p-0.5 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="添加子项"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id)
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
            {item.children.map(child => renderArchitectureItem(child, level + 1))}
          </div>
        )}
      </div>
    )
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
        const importedData = JSON.parse(content) as ArchitectureItem[]
        setFlatArchitecture(importedData)
        setExpandedItems(new Set()) // 导入后默认全部折叠
      } catch (error) {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
    // 重置 input 以便可以重复导入同一个文件
    e.target.value = ''
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">QARE产品信息架构</h1>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <label
              htmlFor="import-file"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>导入</span>
            </label>

            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-md hover:bg-green-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>导出</span>
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1" />

            <button
              onClick={() => handleAdd()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>添加一级菜单</span>
            </button>

            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>展开全部</span>
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span>折叠全部</span>
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          这里展示了QARE产品的整体功能结构和信息层次关系。支持导入导出功能，方便在平台外批量修改。
        </p>
      </div>
      
      <div className="space-y-2 bg-white p-4 rounded-lg shadow-sm">
        {renderArchitecture()}
      </div>
    </div>
  )
} 