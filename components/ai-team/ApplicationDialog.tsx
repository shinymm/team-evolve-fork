import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

interface ApplicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  editingApplication?: {
    id: string
    name: string
    introduction: string
    entryUrl: string
    category?: string
  } | null
}

export function ApplicationDialog({
  open,
  onOpenChange,
  onSuccess,
  editingApplication,
}: ApplicationDialogProps) {
  const { toast } = useToast()
  const t = useTranslations('ai-team-factory.ApplicationDialog')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    introduction: '',
    entryUrl: '',
    category: '',
  })

  // 当编辑应用变化时，重置表单数据
  useEffect(() => {
    console.log('ApplicationDialog useEffect - editingApplication 变化:', editingApplication)
    if (editingApplication) {
      console.log('设置编辑表单数据:', editingApplication)
      setFormData({
        name: editingApplication.name || '',
        introduction: editingApplication.introduction || '',
        entryUrl: editingApplication.entryUrl || '',
        category: editingApplication.category || '',
      })
    } else {
      console.log('重置表单数据为空')
      setFormData({
        name: '',
        introduction: '',
        entryUrl: '',
        category: '',
      })
    }
  }, [editingApplication])

  // 当对话框打开状态变化时记录日志
  useEffect(() => {
    console.log('ApplicationDialog - 对话框打开状态变化:', open)
    console.log('当前编辑的应用:', editingApplication)
    
    // 当对话框关闭时，重置表单数据
    if (!open) {
      console.log('对话框关闭，重置表单数据')
      setFormData({
        name: '',
        introduction: '',
        entryUrl: '',
        category: '',
      })
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('提交表单，阻止默认事件')
    setLoading(true)
    console.log('提交表单:', { isEditing: !!editingApplication, formData })

    try {
      const url = editingApplication
        ? `/api/ai-team/applications/${editingApplication.id}`
        : '/api/ai-team/applications'
      
      const method = editingApplication ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error(editingApplication ? t('errors.updateFailed') : t('errors.addFailed'))
      }

      toast({
        title: '成功',
        description: editingApplication ? t('success.updated') : t('success.added'),
      })

      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error('提交表单失败:', error)
      toast({
        title: '错误',
        description: editingApplication ? t('errors.updateFailed') : t('errors.addFailed'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const isEditing = !!editingApplication
  const title = isEditing ? t('title.edit') : t('title.add')
  const description = isEditing ? t('description.edit') : t('description.add')
  const submitText = isEditing 
    ? (loading ? t('buttons.updating') : t('buttons.update')) 
    : (loading ? t('buttons.adding') : t('buttons.add'))

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        console.log('Dialog onOpenChange:', { 当前: open, 新值: newOpen })
        onOpenChange(newOpen)
      }}
    >
      <DialogContent className="max-w-[70%] w-full">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="w-full px-4">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-12 items-center gap-4">
              <Label htmlFor="name" className="text-right col-span-1">
                {t('labels.name')}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                className="col-span-11"
                required
                placeholder={t('placeholders.name')}
              />
            </div>
            <div className="grid grid-cols-12 items-start gap-4">
              <Label htmlFor="introduction" className="text-right col-span-1 pt-2">
                {t('labels.introduction')}
              </Label>
              <Textarea
                id="introduction"
                value={formData.introduction}
                onChange={handleInputChange}
                className="col-span-11"
                required
                placeholder={t('placeholders.introduction')}
              />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <Label htmlFor="entryUrl" className="text-right col-span-1">
                {t('labels.entryUrl')}
              </Label>
              <Input
                id="entryUrl"
                value={formData.entryUrl}
                onChange={handleInputChange}
                className="col-span-11"
                required
                type="url"
                placeholder={t('placeholders.entryUrl')}
              />
            </div>
            <div className="grid grid-cols-12 items-center gap-4">
              <Label htmlFor="category" className="text-right col-span-1">
                {t('labels.category')}
              </Label>
              <Input
                id="category"
                value={formData.category}
                onChange={handleInputChange}
                className="col-span-11"
                placeholder={t('placeholders.category')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {submitText}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 