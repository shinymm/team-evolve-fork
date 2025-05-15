'use client'

import { useState, useEffect } from 'react'
import { MemberList } from '@/components/ai-team/MemberList'
import { ApplicationList } from '@/components/ai-team/ApplicationList'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

export default function AITeamPage() {
  const [activeTab, setActiveTab] = useState('members')
  const [isLoading, setIsLoading] = useState(true)

  // 处理加载状态变化
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI团队工厂</h1>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">正在加载数据，请稍候...</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">团队成员</TabsTrigger>
          <TabsTrigger value="applications">集成应用</TabsTrigger>
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