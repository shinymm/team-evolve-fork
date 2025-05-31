'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { useTranslations } from 'next-intl'

// 动态导入 BoundaryRules 组件
const BoundaryRules = dynamic(
  () => import('@/components/boundary-rules'),
  { ssr: false }
)

export default function BoundaryPage() {
  const t = useTranslations('BoundaryPage')
  
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>
      <Suspense fallback={<div>{t('loading')}</div>}>
        <BoundaryRules />
      </Suspense>
    </div>
  )
} 