'use client'

import { useState } from 'react'
import { Eye, Bell, ChevronRight, X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { SwaggerViewer } from "@/components/swagger-viewer"
import { SwaggerDocs } from "@/lib/swagger-docs"
import { SubscriptionViewer } from "@/components/subscription-viewer"
import { useAPIInterfacesStore } from "@/lib/stores/api-interfaces-store"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// 使用从store导出的类型，不再需要在这里定义
import type { APIInterface } from "@/lib/stores/api-interfaces-store"

export default function APIInterfacesPage() {
  // 使用Zustand store
  const { interfaces, subscriptions } = useAPIInterfacesStore()
  
  const [selectedEndpoint, setSelectedEndpoint] = useState<keyof SwaggerDocs | null>(null)
  const [showSubscriptions, setShowSubscriptions] = useState<string | null>(null)
  const [selectedApi, setSelectedApi] = useState<APIInterface | null>(null)

  const getTypeColor = (type: APIInterface['type']) => {
    const colors = {
      'REST': 'bg-blue-50 text-blue-700',
      'Kafka': 'bg-green-50 text-green-700',
      'RPC': 'bg-purple-50 text-purple-700',
      'GraphQL': 'bg-pink-50 text-pink-700'
    }
    return colors[type] || 'bg-gray-50 text-gray-700'
  }

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">API开放接口</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了系统对外开放的API接口，以及接口的订阅情况。
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {interfaces.map((api) => (
          <div key={api.id} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium text-gray-900">{api.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(api.type)}`}>
                      {api.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{api.description}</p>
                  <div className="mt-2 text-sm text-gray-700">
                    <span className="font-medium">{api.operation}</span> {api.endpoint}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {api.swaggerEndpoint && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (selectedEndpoint === api.swaggerEndpoint) {
                          setSelectedEndpoint(null);
                        } else {
                          setSelectedEndpoint(api.swaggerEndpoint as keyof SwaggerDocs);
                          setShowSubscriptions(null);
                        }
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {selectedEndpoint === api.swaggerEndpoint ? '隐藏文档' : '查看文档'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (showSubscriptions === api.endpoint) {
                        setShowSubscriptions(null);
                      } else {
                        setShowSubscriptions(api.endpoint);
                        setSelectedEndpoint(null);
                      }
                    }}
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    {showSubscriptions === api.endpoint ? '隐藏订阅' : '查看订阅'}
                  </Button>
                </div>
              </div>
            </div>
            
            {selectedEndpoint && api.swaggerEndpoint === selectedEndpoint && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end mb-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedEndpoint(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <SwaggerViewer endpoint={selectedEndpoint} />
                </div>
              </div>
            )}
            
            {showSubscriptions === api.endpoint && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">订阅信息</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowSubscriptions(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <SubscriptionViewer 
                    apiEndpoint={api.endpoint} 
                    subscriptions={subscriptions.find(s => s.apiEndpoint === api.endpoint)?.subscribers || []}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 