'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
          <DialogTitle>输入需求概述</DialogTitle>
          <DialogDescription>
            请输入需求概述，帮助AI更好地理解需求内容并生成需求初稿
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Textarea
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="col-span-2 h-[200px]"
            placeholder="请输入需求描述，例如：希望设计一个移动端产品功能，实现用户可以便捷地进行商品类型筛选..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => onSubmit(text)} disabled={!text.trim()}>生成需求初稿</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 