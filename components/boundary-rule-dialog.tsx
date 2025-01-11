'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { BoundaryRule } from "@/types/boundary"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: BoundaryRule | null
  onSave: (rule: Partial<BoundaryRule>) => void
}

export function BoundaryRuleDialog({ open, onOpenChange, rule, onSave }: Props) {
  const [formData, setFormData] = useState<Partial<BoundaryRule>>({})

  useEffect(() => {
    if (rule) {
      setFormData(rule)
    } else {
      setFormData({})
    }
  }, [rule])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? '编辑规则' : '添加规则'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="checkItem">检查项</Label>
            <Input
              id="checkItem"
              value={formData.checkItem || ''}
              onChange={(e) => setFormData({ ...formData, checkItem: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="scenario">适用场景</Label>
            <Input
              id="scenario"
              value={formData.scenario || ''}
              onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-start gap-4">
            <Label htmlFor="checkPoints">检查要点</Label>
            <Textarea
              id="checkPoints"
              value={formData.checkPoints || ''}
              onChange={(e) => setFormData({ ...formData, checkPoints: e.target.value })}
              required
              rows={4}
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-center gap-4">
            <Label htmlFor="example">示例</Label>
            <Input
              id="example"
              value={formData.example || ''}
              onChange={(e) => setFormData({ ...formData, example: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-[120px,1fr] items-start gap-4">
            <Label htmlFor="boundaryExample">边界示例</Label>
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
              保存
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 