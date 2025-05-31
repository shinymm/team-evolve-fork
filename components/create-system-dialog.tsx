'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

export interface CreateSystemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateSystemDialog({ open, onOpenChange, onSuccess }: CreateSystemDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('CreateSystemDialog');
  
  // 定义表单验证模式
  const formSchema = z.object({
    name: z.string().min(2, t('validationNameMin')).max(50, t('validationNameMax')),
    description: z.string().optional(),
  })

  type FormData = z.infer<typeof formSchema>
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true)
      
      const response = await fetch('/api/systems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('createFailedError'))
      }

      toast({
        title: t('createSuccessTitle'),
        description: t('createSuccessDescription', { name: data.name }),
      })
      
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('创建系统失败:', error)
      toast({
        title: t('createFailedTitle'),
        description: error instanceof Error ? error.message : t('unknownError'),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full md:w-1/2">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {t('description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                {t('labelName')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder={t('placeholderName')}
                {...register('name')}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">{t('labelDescription')}</Label>
              <Textarea
                id="description"
                placeholder={t('placeholderDescription')}
                {...register('description')}
                disabled={isLoading}
                rows={4}
              />
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description.message}</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t('buttonCancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('buttonCreate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 