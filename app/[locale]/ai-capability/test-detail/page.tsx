'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { TooltipProvider } from "@/components/ui/tooltip"

// 动态导入测试详情组件
const TestDetailAssistant = dynamic(() => import('@/components/test-detail-assistant').then(mod => ({ default: mod.TestDetailAssistant })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-6 rounded-md bg-gray-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
    <p className="ml-3 text-sm text-gray-500">加载测试详情组件...</p>
  </div>
})

export default function TestDetailPage({params: {locale}}: {params: {locale: string}}) {
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