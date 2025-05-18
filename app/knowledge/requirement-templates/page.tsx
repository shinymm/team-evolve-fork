'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Save, Loader2, BookOpen, Pencil } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSystemStore } from '@/lib/stores/system-store'

export default function RequirementTemplatePage() {
  const [template, setTemplate] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { selectedSystemId, systems } = useSystemStore()
  const currentSystem = systems.find(sys => sys.id === selectedSystemId)

  useEffect(() => {
    if (selectedSystemId) {
      loadTemplate()
    }
  }, [selectedSystemId])

  const loadTemplate = async () => {
    if (!selectedSystemId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/requirement-templates?systemId=${selectedSystemId}`)
      const data = await response.json()
      
      if (data.template?.content) {
        setTemplate(data.template.content)
      } else {
        // 如果没有模板，设置一个默认的
        setTemplate(`# ${currentSystem?.name || '系统'} 需求书模版

## 修订记录

| 版本号 | 作者 | 操作日期 | 操作说明 |
|--------|------|----------|:---------|
| V1.0   |      |          | 创建     |

## 1. 背景与目标

### 1.1 背景描述

_描述项目的背景和起因_

### 1.2 业务目标

_描述本次需求要实现的业务目标_

## 2. 功能需求

### 2.1 核心功能

_描述核心功能点_

### 2.2 用户故事

_以用户故事的形式描述需求_

## 3. 非功能需求

### 3.1 性能需求

_描述性能相关的需求_

### 3.2 安全需求

_描述安全相关的需求_

## 4. 界面要求

_描述UI/UX相关的要求_

## 5. 技术要求

_描述技术实现相关的要求_

## 6. 验收标准

_描述验收的标准和条件_
`)
      }
    } catch (error) {
      console.error('加载模板失败', error)
      toast({
        title: '加载失败',
        description: '获取需求书模版失败',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const saveTemplate = async () => {
    if (!selectedSystemId) {
      toast({
        title: '保存失败',
        description: '请先选择一个系统',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/requirement-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemId: selectedSystemId,
          content: template
        })
      })

      if (response.ok) {
        toast({
          title: '保存成功',
          description: '需求书模版已保存'
        })
        setIsEditing(false)
      } else {
        const data = await response.json()
        throw new Error(data.error || '保存失败')
      }
    } catch (error) {
      console.error('保存模板失败', error)
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '保存需求书模版失败',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!selectedSystemId) {
    return (
      <div className="w-[90%] mx-auto py-4">
        <h1 className="text-xl font-bold mb-4">需求书模版</h1>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">
              请先在顶部选择一个系统
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-[90%] mx-auto py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">需求书模版</h1>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button 
                onClick={saveTemplate} 
                disabled={isSaving}
                className="h-8 px-3"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                保存模版
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                className="h-8 px-3"
              >
                取消
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setIsEditing(true)}
              className="h-8 px-3"
            >
              <Pencil className="h-4 w-4 mr-1" />
              编辑模版
            </Button>
          )}
        </div>
      </div>
      
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : isEditing ? (
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-[600px] w-full resize-y font-mono text-sm"
              placeholder="在此编辑需求书模版内容..."
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
                  h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
                  h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
                  p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
                  ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                  ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                  li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
                  blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
                  code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
                  pre: ({children}: {children: React.ReactNode}) => <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm">{children}</pre>,
                  table: ({children}: {children: React.ReactNode}) => <table className="min-w-full border-collapse my-4 text-sm">{children}</table>,
                  thead: ({children}: {children: React.ReactNode}) => <thead className="bg-gray-50">{children}</thead>,
                  tbody: ({children}: {children: React.ReactNode}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
                  tr: ({children}: {children: React.ReactNode}) => <tr>{children}</tr>,
                  th: ({children}: {children: React.ReactNode}) => <th className="px-3 py-2 text-left font-medium text-gray-900 border border-gray-200">{children}</th>,
                  td: ({children}: {children: React.ReactNode}) => <td className="px-3 py-2 text-gray-600 border border-gray-200">{children}</td>
                }}
              >
                {template}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 