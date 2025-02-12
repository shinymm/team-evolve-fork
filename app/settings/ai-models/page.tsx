'use client'

import { Suspense } from 'react'
import { AIModelSettings } from '@/components/ai-model-settings'
import { Skeleton } from "@/components/ui/skeleton"

export default function AIModelsPage() {
  return (
    <div className="container mx-auto p-6">
      <Suspense fallback={<Skeleton className="h-[400px]" />}>
        <AIModelSettings />
      </Suspense>
    </div>
  )
}
 
