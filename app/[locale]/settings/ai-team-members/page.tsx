'use client'

import { useState } from 'react'
import { MemberList } from '@/components/ai-team/MemberList'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AITeamMembersPage() {
  const [isLoading, setIsLoading] = useState(true)
  const t = useTranslations('AITeamPage') // Assuming you might reuse some translations

  // 处理加载状态变化
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        {/* Title can be more specific, e.g., t('aiTeamMembers.title') if you add it */}
        <h1 className="text-2xl font-bold">{t('tabs.members')}</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">{t('loading')}</span>
        </div>
      )}

      <div className="space-y-4">
        <MemberList onStatusChange={handleStatusChange} />
      </div>
    </div>
  )
} 