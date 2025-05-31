'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useState, useEffect, useRef } from "react"
import { BoundaryRule } from "@/types/boundary"
import { useTranslations } from "next-intl"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: BoundaryRule | null
  onSave: (rule: Partial<BoundaryRule>) => void
  className?: string
}

export function BoundaryRuleDialog({ open, onOpenChange, rule, onSave, className }: Props) {
  const [formData, setFormData] = useState<Partial<BoundaryRule>>({})
  const originalRule = useRef<BoundaryRule | null>(null)
  const t = useTranslations('BoundaryRuleDialog')

  useEffect(() => {
    if (rule) {
      originalRule.current = { ...rule }
      setFormData({ ...rule })
    } else {
      originalRule.current = null
      setFormData({})
    }
  }, [rule])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleCancel = () => {
    if (originalRule.current) {
      setFormData({ ...originalRule.current })
    } else {
      setFormData({})
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancel()
      } else {
        onOpenChange(true)
      }
    }}>
      <DialogContent className={className || "max-w-[80%] w-[80%] max-h-[80vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>{rule ? t('editRule') : t('addRule')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="checkItem">{t('checkItem')}</Label>
            <Input
              id="checkItem"
              value={formData.checkItem || ''}
              onChange={(e) => setFormData({ ...formData, checkItem: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="scenario">{t('scenario')}</Label>
            <Input
              id="scenario"
              value={formData.scenario || ''}
              onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-start gap-4">
            <Label htmlFor="checkPoints">{t('checkPoints')}</Label>
            <Textarea
              id="checkPoints"
              value={formData.checkPoints || ''}
              onChange={(e) => setFormData({ ...formData, checkPoints: e.target.value })}
              required
              rows={4}
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="example">{t('example')}</Label>
            <Input
              id="example"
              value={formData.example || ''}
              onChange={(e) => setFormData({ ...formData, example: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-start gap-4">
            <Label htmlFor="boundaryExample">{t('boundaryExample')}</Label>
            <Textarea
              id="boundaryExample"
              value={formData.boundaryExample || ''}
              onChange={(e) => setFormData({ ...formData, boundaryExample: e.target.value })}
              required
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="submit">
              {t('save')}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 