'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from "@/components/ui/skeleton"
import { AIModelSettings } from '@/components/ai-model-settings'
import { Loader2 } from 'lucide-react'

export default function AIModelsPage() {
  const [isLoading, setIsLoading] = useState(true)
  
  // 处理加载状态变化
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }
  
  return (
    <div className="w-[90%] mx-auto">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">正在加载模型配置，请稍候...</span>
        </div>
      )}
      
      <div className="space-y-12">
        <AIModelSettings onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
}
 
