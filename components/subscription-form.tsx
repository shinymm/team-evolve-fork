'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SubscriptionFormProps {
  isOpen: boolean
  onClose: () => void
  apiName: string
  onSubmit: (data: { systemId: string; systemName: string }) => void
}

export function SubscriptionForm({ isOpen, onClose, apiName, onSubmit }: SubscriptionFormProps) {
  const [systemId, setSystemId] = useState('')
  const [systemName, setSystemName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ systemId, systemName })
    setSystemId('')
    setSystemName('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>订阅 {apiName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemId">系统编号</Label>
            <Input
              id="systemId"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              placeholder="如: mobile"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemName">系统名称</Label>
            <Input
              id="systemName"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="如: 手机银行"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">
              确认订阅
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 