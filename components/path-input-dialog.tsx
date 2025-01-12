'use client'

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useState } from "react"

interface PathInputDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (path: string) => void
  isLoading: boolean
}

export function PathInputDialog({ isOpen, onOpenChange, onSubmit, isLoading }: PathInputDialogProps) {
  const [path, setPath] = useState('')

  const handleSubmit = () => {
    if (path.trim()) {
      onSubmit(path.trim())
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>输入操作路径</DialogTitle>
          <DialogDescription>
            请输入简要的操作路径，例如：知识引擎-FAQ-批量导入
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="知识引擎-FAQ-批量导入"
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
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!path.trim() || isLoading}
          >
            {isLoading ? "生成中..." : "确定"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 