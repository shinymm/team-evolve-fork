'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SubscriptionViewerProps {
  isOpen: boolean
  onClose: () => void
  apiName: string
}

const subscriptions = [
  { id: '95558', name: '语音客服' },
  { id: 'mobile', name: '手机银行' },
  { id: 'branch', name: '各个分行' },
  { id: 'jituan', name: '协同机器人' },
  { id: 'trade', name: '金市交易平台' },
  { id: 'corpweb', name: '对公网银/APP' },
  { id: 'mpp', name: '对公队伍工作台' },
  { id: 'operate', name: '运维系统' },
  { id: 'money', name: '报销问答系统' },
  { id: 'counter', name: '柜面系统' }
]

export function SubscriptionViewer({ isOpen, onClose, apiName }: SubscriptionViewerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{apiName} - 订阅系统列表</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-full max-h-[60vh] pr-4">
          <div className="border rounded-md">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 px-4 py-2 border-b">
              <div className="text-xs font-medium text-gray-500 uppercase">系统编号</div>
              <div className="text-xs font-medium text-gray-500 uppercase">订阅系统</div>
            </div>
            <div className="divide-y divide-gray-200">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="px-4 py-3 grid grid-cols-2 gap-4 hover:bg-gray-50">
                  <div className="text-sm font-mono text-gray-600">{sub.id}</div>
                  <div className="text-sm text-gray-900">{sub.name}</div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
} 