'use client'

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface PathInputDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (path: string) => void
  isLoading: boolean
}

export function PathInputDialog({ isOpen, onOpenChange, onSubmit, isLoading }: PathInputDialogProps) {
  const [path, setPath] = useState('')
  const t = useTranslations('PathInputDialog')

  const handleSubmit = () => {
    if (path.trim()) {
      onSubmit(path.trim())
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder={t('placeholder')}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="w-full"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('cancelButton')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!path.trim() || isLoading}
          >
            {isLoading ? t('submittingButton') : t('submitButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 