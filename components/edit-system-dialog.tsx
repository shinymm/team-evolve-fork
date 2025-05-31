'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { type System } from '@/lib/stores/system-store'
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'

// 定义表单验证模式
const formSchema = z.object({
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export interface EditSystemDialogProps {
  system: System
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditSystemDialog({ system, open, onOpenChange, onSuccess }: EditSystemDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('EditSystemDialog');
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: system.description || '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/systems/${system.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('updateFailedError'))
      }

      toast({
        title: t('updateSuccessTitle'),
        description: t('updateSuccessDescription'),
      })
      
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('更新系统失败:', error)
      toast({
        title: t('updateFailedTitle'),
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
              {system.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="description">{t('labelDescription')}</Label>
              <Textarea
                id="description"
                placeholder={t('placeholderDescription')}
                {...register('description')}
                disabled={isLoading}
                rows={6}
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
              {t('buttonSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 