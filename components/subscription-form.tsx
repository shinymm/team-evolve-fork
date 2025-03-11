'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiName: string
  onSubmit: (data: { systemId: string; systemName: string }) => void
}

export function SubscriptionForm({ open, onOpenChange, apiName, onSubmit }: SubscriptionFormProps) {
  const [systemId, setSystemId] = useState('')
  const [systemName, setSystemName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!systemId || !systemName) return
    
    onSubmit({ systemId, systemName })
    setSystemId('')
    setSystemName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>订阅 {apiName} 接口</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemId">系统编号</Label>
            <Input
              id="systemId"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              placeholder="请输入系统编号"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemName">系统名称</Label>
            <Input
              id="systemName"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="请输入系统名称"
              required
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">提交</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 