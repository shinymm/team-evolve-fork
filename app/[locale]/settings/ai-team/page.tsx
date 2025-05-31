'use client'

import { useState, useEffect } from 'react'
import { MemberList } from '@/components/ai-team/MemberList'
import { ApplicationList } from '@/components/ai-team/ApplicationList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function AITeamPage() {
  const [activeTab, setActiveTab] = useState('members')
  const [isLoading, setIsLoading] = useState(true)
  const t = useTranslations('AITeamPage')

  // 处理加载状态变化
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">{t('loading')}</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">{t('tabs.members')}</TabsTrigger>
          <TabsTrigger value="applications">{t('tabs.applications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <MemberList onStatusChange={handleStatusChange} />
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <ApplicationList onStatusChange={handleStatusChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}