'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SubscriptionViewerProps {
  isOpen: boolean
  onClose: () => void
  apiName: string
  apiEndpoint: string
  subscriptions: Array<{
    systemId: string
    systemName: string
  }>
}

export function SubscriptionViewer({ isOpen, onClose, apiName, apiEndpoint, subscriptions }: SubscriptionViewerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{apiName} - 订阅系统列表</DialogTitle>
          <DialogDescription id="dialog-description">
            显示 {apiEndpoint} 的所有订阅系统信息
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh] pr-4">
          <div className="border rounded-md">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 px-4 py-2 border-b">
              <div className="text-xs font-medium text-gray-500 uppercase">系统编号</div>
              <div className="text-xs font-medium text-gray-500 uppercase">订阅系统</div>
            </div>
            <div className="divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <div key={sub.systemId} className="px-4 py-3 grid grid-cols-2 gap-4 hover:bg-gray-50">
                  <div className="text-sm font-mono text-gray-600">{sub.systemId}</div>
                  <div className="text-sm text-gray-900">{sub.systemName}</div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 