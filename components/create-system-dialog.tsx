'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

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

// 定义表单验证模式
const formSchema = z.object({
  name: z.string().min(2, '系统名称至少需要2个字符').max(50, '系统名称不能超过50个字符'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export interface CreateSystemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateSystemDialog({ open, onOpenChange, onSuccess }: CreateSystemDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  
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
        throw new Error(errorData.error || '创建系统失败')
      }

      toast({
        title: '创建成功',
        description: `系统 "${data.name}" 已成功创建`,
      })
      
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('创建系统失败:', error)
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>创建新系统</DialogTitle>
            <DialogDescription>
              填写系统信息，创建新的系统。
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                系统名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="输入系统名称"
                {...register('name')}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">系统描述</Label>
              <Textarea
                id="description"
                placeholder="输入系统描述（可选）"
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
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 