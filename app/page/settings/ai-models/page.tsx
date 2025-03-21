'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from "@/components/ui/skeleton"
import { AIModelSettings } from '@/components/ai-model-settings'

export default function AIModelsPage() {
  const [isLoading, setIsLoading] = useState(true)
  
  // 使用 setTimeout 模拟加载过程，避免页面闪烁
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 50)
    
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <div className="w-[90%] mx-auto">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[400px]" />
        </div>
      ) : (
        <AIModelSettings />
      )}
    </div>
  )
}
 
