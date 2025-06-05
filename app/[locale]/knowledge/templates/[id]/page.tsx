'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useToast } from '@/components/ui/use-toast'
import { Template } from '@/lib/services/template-service'
import { ArrowLeft, Save, X, Plus, Loader2 } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import React from 'react'

// 动态导入UI组件
const Button = dynamic(() => import('@/components/ui/button').then(mod => mod.Button))
const Input = dynamic(() => import('@/components/ui/input').then(mod => mod.Input))
const Textarea = dynamic(() => import('@/components/ui/textarea').then(mod => mod.Textarea))
const Card = dynamic(() => import('@/components/ui/card').then(mod => mod.Card))
const CardContent = dynamic(() => import('@/components/ui/card').then(mod => mod.CardContent))
const CardHeader = dynamic(() => import('@/components/ui/card').then(mod => mod.CardHeader))
const CardTitle = dynamic(() => import('@/components/ui/card').then(mod => mod.CardTitle))
const CardDescription = dynamic(() => import('@/components/ui/card').then(mod => mod.CardDescription))
const CardFooter = dynamic(() => import('@/components/ui/card').then(mod => mod.CardFooter))
const AlertDialog = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialog))
const AlertDialogAction = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogAction))
const AlertDialogCancel = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogCancel))
const AlertDialogContent = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogContent))
const AlertDialogDescription = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogDescription))
const AlertDialogFooter = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogFooter))
const AlertDialogHeader = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogHeader))
const AlertDialogTitle = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogTitle))
const Badge = dynamic(() => import('@/components/ui/badge').then(mod => mod.Badge))
const Tabs = dynamic(() => import('@/components/ui/tabs').then(mod => mod.Tabs))
const TabsList = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsList))
const TabsTrigger = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsTrigger))
const TabsContent = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsContent))

interface TemplatePageProps {
  params: {
    id: string
  }
}

export default function TemplatePage({ params }: TemplatePageProps) {
  const { id } = params
  const [template, setTemplate] = useState<Template | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    tags: [] as string[]
  })
  const [newTag, setNewTag] = useState('')
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('TemplateCenter')

  // 获取模版详情
  const fetchTemplate = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/templates/${id}`)
      if (response.status === 404) {
        toast({
          title: t('notFound'),
          description: t('notFoundDesc'),
          variant: "destructive"
        })
        router.push('/knowledge/templates')
        return
      }
      
      if (!response.ok) throw new Error('获取模版详情失败')
      
      const data = await response.json()
      setTemplate(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        content: data.content,
        tags: data.tags || []
      })
    } catch (error) {
      console.error('获取模版详情失败:', error)
      toast({
        title: t('fetchDetailFailed'),
        description: t('fetchDetailFailedDesc'),
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplate()
  }, [id])

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 添加新标签
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.name || !formData.content) {
      toast({
        title: t('validationFailed'),
        description: t('requiredFields'),
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('更新模版失败')

      const updatedTemplate = await response.json()
      setTemplate(updatedTemplate)
      setEditMode(false)
      
      toast({
        title: t('updateSuccess'),
        description: t('updateSuccessDesc'),
      })
    } catch (error) {
      console.error('更新模版失败:', error)
      toast({
        title: t('updateFailed'),
        description: t('updateFailedDesc'),
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  // 处理删除模版
  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) {
      return
    }

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('删除模版失败')

      toast({
        title: t('deleteSuccess'),
        description: t('deleteSuccessDesc'),
      })
      
      router.push('/knowledge/templates')
    } catch (error) {
      console.error('删除模版失败:', error)
      toast({
        title: t('deleteFailed'),
        description: t('deleteFailedDesc'),
        variant: "destructive"
      })
    }
  }

  // 返回列表页
  const goBack = () => {
    router.push('/knowledge/templates')
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center">
        <div className="w-full max-w-7xl px-4 py-12 text-center">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 py-12">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={goBack} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{editMode ? t('editTemplate') : template?.name}</h1>
          
          <div className="ml-auto">
            {editMode ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setEditMode(false)} 
                  className="mr-2"
                  disabled={isSaving}
                >
                  {t('cancel')}
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSaving}
                  className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
                >
                  {isSaving ? t('saving') : t('save')}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleDelete} 
                  className="mr-2 text-red-500 hover:text-red-700"
                >
                  {t('delete')}
                </Button>
                <Button 
                  onClick={() => setEditMode(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
                >
                  {t('edit')}
                </Button>
              </>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
            <div>
              <label className="block text-sm font-medium mb-1">{t('name')}</label>
              <Input 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('description')}</label>
              <Textarea 
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('tags')}</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex gap-1 items-center">
                    {tag}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder={t('addTag')}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button variant="outline" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('content')}</label>
              <Textarea 
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                rows={20}
                className="font-mono"
              />
            </div>
          </div>
        ) : (
          <Card className="bg-white shadow-sm">
            <CardHeader>
              <CardTitle>{template?.name}</CardTitle>
              {template?.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {template?.tags.map(tag => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <Markdown 
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
                  {template?.content || ''}
                </Markdown>
              </div>
            </CardContent>
            <CardFooter className="text-sm text-gray-500">
              <div>{t('createdAt')}: {new Date(template?.createdAt || '').toLocaleString()}</div>
              <div className="ml-auto">{t('updatedAt')}: {new Date(template?.updatedAt || '').toLocaleString()}</div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
} 