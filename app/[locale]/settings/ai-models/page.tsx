'use client'

import { useState, useEffect } from 'react'
// import { Skeleton } from "@/components/ui/skeleton" // Skeleton might not be needed if loading handles whole page
import { AIModelSettings } from '@/components/ai-model-settings'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import VectorSettings from '@/components/vector-settings'

export default function AIModelsPage() {
  const [isLoading, setIsLoading] = useState(true) 
  const t = useTranslations('AIModelsPage')
  const tShared = useTranslations('AIModelSettings')
  
  const handleStatusChange = (loading: boolean) => {
    setIsLoading(loading)
  }
  
  // Simulate initial loading for the page if needed, or let individual components handle their loading.
  useEffect(() => {
    // Example: simulate initial data fetch loading, then set to false
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    // Add padding to the main container for overall spacing from header and sides
    <div className="w-[90%] mx-auto py-6 lg:py-8">
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500 mr-2" />
          <span className="text-sm text-orange-500">{t('loading')}</span>
        </div>
      )}
      
      {/* Add top margin to the Tabs component for spacing from the header */}
      <Tabs defaultValue="ai-models" className="space-y-6 mt-6">
        <TabsList>
          <TabsTrigger value="ai-models">{tShared('tabs.models')}</TabsTrigger>
          <TabsTrigger value="vector-models">{tShared('tabs.vector')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ai-models">
          {/* Removed H2 titles, relying on Card titles from AIModelSettings */}
          <div className="space-y-8"> {/* Increased spacing between cards */}
            <AIModelSettings modelType="language" onStatusChange={handleStatusChange} />
            <AIModelSettings modelType="reasoning" onStatusChange={handleStatusChange} />
            <AIModelSettings modelType="vision" onStatusChange={handleStatusChange} />
          </div>
        </TabsContent>
        
        <TabsContent value="vector-models">
          <VectorSettings onStatusChange={handleStatusChange} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
 
