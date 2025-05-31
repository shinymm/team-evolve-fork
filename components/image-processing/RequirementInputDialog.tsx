'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RequirementInputDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  initialValue?: string
}

export const RequirementInputDialog = ({
  open,
  onClose,
  onSubmit,
  initialValue = ''
}: RequirementInputDialogProps) => {
  const t = useTranslations('ImageProcessingPage');
  const [text, setText] = useState(initialValue)
  
  // 当对话框打开时重置文本
  useEffect(() => {
    if (open) {
      setText(initialValue)
    }
  }, [open, initialValue])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose()
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('requirementDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('requirementDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Textarea
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="col-span-2 h-[200px]"
            placeholder={t('requirementDialog.placeholder')}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('requirementDialog.cancel')}</Button>
          <Button onClick={() => onSubmit(text)} disabled={!text.trim()}>{t('requirementDialog.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 