'use client'

import { TestDetailAssistant } from "@/components/test-detail-assistant"
import { useTranslations } from 'next-intl'
import { TooltipProvider } from "@/components/ui/tooltip"

export default function TestDetailPage() {
  const t = useTranslations('TestDetailPage')
  
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      <TooltipProvider>
        <TestDetailAssistant />
      </TooltipProvider>
    </div>
  )
} 