'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, X, Plus } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslations } from 'next-intl'
import React from 'react'
import { useSystemStore } from '@/lib/stores/system-store'

export default function CreateStandardPage() {
  const { systems, selectedSystemId } = useSystemStore()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    tags: [] as string[],
    systemId: selectedSystemId || ''
  })
  const [newTag, setNewTag] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('StandardCenter')

  // 确保有可用的系统ID
  useEffect(() => {
    // 调试日志，查看当前选择的系统
    console.log('当前系统状态:', { 
      selectedSystemId, 
      systems, 
      formDataSystemId: formData.systemId
    });
    
    if (!formData.systemId && selectedSystemId) {
      setFormData(prev => ({
        ...prev,
        systemId: selectedSystemId
      }))
    }
  }, [selectedSystemId, systems])

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

    // 检查是否有系统ID
    if (!formData.systemId) {
      console.error('提交失败: 没有可用的系统ID');
      toast({
        title: '系统错误',
        description: '没有选择系统或无法获取系统ID，请刷新页面重试',
        variant: "destructive"
      })
      return
    }
    
    console.log('提交标准数据:', { ...formData, systemId: formData.systemId });

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/standards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建规范失败');
      }

      const newStandard = await response.json()
      
      toast({
        title: t('createSuccess'),
        description: t('createSuccessDesc'),
      })
      
      router.push(`/knowledge/standards/${newStandard.id}`)
    } catch (error) {
      console.error('创建规范失败:', error)
      toast({
        title: t('createFailed'),
        description: error instanceof Error ? error.message : t('createFailedDesc'),
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 返回列表页
  const goBack = () => {
    router.push('/knowledge/standards')
  }

  // 显示当前选择的系统信息（调试用）
  const selectedSystem = systems.find(s => s.id === formData.systemId);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center">
      <div className="w-full max-w-7xl px-4 py-12">
        <div className="flex items-center mb-8">
          <Button variant="ghost" onClick={goBack} className="mr-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back')}
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{t('newStandard')}</h1>
          
          {/* 显示当前选中的系统（仅开发环境） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="ml-4 text-xs text-gray-500">
              系统ID: {formData.systemId || '未选择'} 
              {selectedSystem && ` (${selectedSystem.name})`}
            </div>
          )}
        </div>

        <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1">{t('name')} <span className="text-red-500">*</span></label>
            <Input 
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder={t('namePlaceholder')}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('description')}</label>
            <Textarea 
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={t('descriptionPlaceholder')}
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
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              />
              <Button variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('content')} <span className="text-red-500">*</span></label>
            <Textarea 
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder={t('contentPlaceholder')}
              rows={20}
              className="font-mono"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              variant="outline" 
              onClick={goBack} 
              className="mr-2"
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !formData.systemId}
              className="bg-orange-500 hover:bg-orange-600 text-base px-5 py-2 h-auto shadow-md"
            >
              {isSubmitting ? t('submitting') : t('createStandard')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 