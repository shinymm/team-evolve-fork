'use client'

import { ScrollArea } from "@/components/ui/scroll-area"

interface SubscriptionViewerProps {
  apiEndpoint: string
  subscriptions: Array<{
    systemId: string
    systemName: string
  }>
}

export function SubscriptionViewer({ apiEndpoint, subscriptions }: SubscriptionViewerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">订阅系统列表</h3>
        <p className="text-sm text-gray-500 mt-1">
          以下系统已订阅 {apiEndpoint} 接口
        </p>
      </div>
      
      {subscriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          暂无系统订阅此接口
        </div>
      ) : (
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <div key={sub.systemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <div className="font-medium">{sub.systemName}</div>
                  <div className="text-sm text-gray-500">系统ID: {sub.systemId}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
} 