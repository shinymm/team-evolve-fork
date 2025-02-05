'use client'

import { useState } from 'react'
import { Eye, Bell, ChevronRight, PlusCircle } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { SwaggerViewer } from "@/components/swagger-viewer"
import { SwaggerDocs } from "@/lib/swagger-docs"
import { SubscriptionViewer } from "@/components/subscription-viewer"
import { SubscriptionForm } from "@/components/subscription-form"
import { handleNewSubscription } from "@/lib/services/task-control"

interface APIInterface {
  id: string
  name: string
  description: string
  type: 'REST' | 'Kafka' | 'RPC' | 'GraphQL'
  endpoint: string
  operation: string
  swaggerEndpoint?: keyof SwaggerDocs
}

interface APISubscription {
  apiEndpoint: string
  subscribers: Array<{
    systemId: string
    systemName: string
  }>
}

const initialInterfaces: APIInterface[] = [
    {
        id: '1',
        name: '文本机器人对话接口',
        description: '提供文本机器人的对话功能，支持流式返回和一次性返回两种模式',
        type: 'REST',
        endpoint: '/api/v1/chat',
        operation: 'POST',
        swaggerEndpoint: '/api/v1/chat'
    },
    {
        id: '2',
        name: '外呼任务下发接口',
        description: '提供外呼任务的下发功能',
        type: 'REST',
        endpoint: '/api/v1/outcall/tasks',
        operation: 'POST',
        swaggerEndpoint: '/api/v1/outcall/tasks'
    }
]

export default function APIInterfacesPage() {
  const [interfaces] = useState<APIInterface[]>(initialInterfaces)
  const [selectedEndpoint, setSelectedEndpoint] = useState<keyof SwaggerDocs | null>(null)
  const [showSubscriptions, setShowSubscriptions] = useState<string | null>(null)
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)
  const [subscriptions, setSubscriptions] = useState(initialInterfaces)
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

  const handleSubscribe = async (data: { systemId: string; systemName: string }) => {
    // 1. 更新本地状态
    setSubscriptions(prev => [...prev, {
      id: data.systemId,
      name: data.systemName,
      description: `${data.systemName} 的订阅`,
      type: 'REST',
      endpoint: '/api/v1/chat',
      operation: 'POST'
    }])
    
    // 2. 触发任务中控
    await handleNewSubscription({
      systemId: data.systemId,
      systemName: data.systemName,
      apiEndpoint: '/api/v1/chat'
    })
  }

  // 模拟不同接口的订阅数据
  const subscriptionsByApi: APISubscription[] = [
    {
      apiEndpoint: '/api/v1/chat',
      subscribers: [
        { systemId: '95558', systemName: '语音客服' },
        { systemId: 'mobile', systemName: '手机银行' },
        { systemId: 'branch', systemName: '各个分行' },
        { systemId: 'jituan', systemName: '协同机器人' },
        { systemId: 'trade', systemName: '金市交易平台' },
        { systemId: 'corpweb', systemName: '对公网银/APP' },
        { systemId: 'mpp', systemName: '对公队伍工作台' },
        { systemId: 'operate', systemName: '运维系统' },
        { systemId: 'money', systemName: '报销问答系统' },
        { systemId: 'counter', systemName: '柜面系统' },
        { systemId: 'opr', systemName: '坐席辅助' },
        { systemId: 'm', systemName: '队伍工作台' }
      ]
    },
    {
      apiEndpoint: '/api/v1/outcall/tasks',
      subscribers: [
        { systemId: 'mpp', systemName: '对公队伍工作台' },
        { systemId: 'opr', systemName: '坐席辅助' },
        { systemId: 'm', systemName: '队伍工作台' },
      ]
    }
  ]

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">API 开放接口</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了系统所有的API接口信息，包括REST API、消息队列Topic以及RPC服务等。
        </p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  接口概述
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  接口类型
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Endpoint/Topic/Service
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {interfaces.map((api) => (
                <tr key={api.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{api.name}</div>
                    <div className="text-sm text-gray-500">{api.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(api.type)}`}>
                      {api.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-mono">{api.endpoint}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-mono">{api.operation}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-600 hover:text-orange-900"
                      title="查看接口详情"
                      onClick={() => setSelectedEndpoint(api.swaggerEndpoint)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-600 hover:text-orange-900"
                      title="查看订阅列表"
                      onClick={() => {
                        setSelectedApi(api)
                        setShowSubscriptions(api.name)
                      }}
                    >
                      <Bell className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-orange-600 hover:text-orange-900"
                      title="订阅接口"
                      onClick={() => setShowSubscriptionForm(true)}
                    >
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEndpoint && (
        <SwaggerViewer 
          isOpen={!!selectedEndpoint}
          onClose={() => setSelectedEndpoint(null)}
          endpoint={selectedEndpoint}
        />
      )}

      {showSubscriptions && selectedApi && (
        <SubscriptionViewer
          isOpen={!!showSubscriptions}
          onClose={() => {
            setShowSubscriptions(null)
            setSelectedApi(null)
          }}
          apiName={showSubscriptions}
          apiEndpoint={selectedApi.endpoint}
          subscriptions={subscriptionsByApi.find(s => s.apiEndpoint === selectedApi.endpoint)?.subscribers || []}
        />
      )}

      <SubscriptionForm
        isOpen={showSubscriptionForm}
        onClose={() => setShowSubscriptionForm(false)}
        apiName={selectedEndpoint || ''}
        onSubmit={handleSubscribe}
      />
    </div>
  )
} 