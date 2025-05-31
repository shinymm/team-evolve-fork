'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from "@/components/ui/skeleton"
import { AIModelSettings } from '@/components/ai-model-settings'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AIModelsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const t = useTranslations('AIModelsPage')
  
  // 处理加载状态变化
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }
  
  return (
    <div className="w-[90%] mx-auto">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">{t('loading')}</span>
        </div>
      )}
      
      <div className="space-y-12">
        <AIModelSettings onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
}
 
