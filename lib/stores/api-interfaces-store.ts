import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { SwaggerDocs } from "@/lib/swagger-docs"

// 定义API接口类型
export interface APIInterface {
  id: string
  name: string
  description: string
  type: 'REST' | 'Kafka' | 'RPC' | 'GraphQL'
  endpoint: string
  operation: string
  swaggerEndpoint?: keyof SwaggerDocs
}

// 定义API订阅类型
export interface APISubscription {
  apiEndpoint: string
  subscribers: Array<{
    systemId: string
    systemName: string
  }>
}

// 默认API接口列表
const DEFAULT_INTERFACES: APIInterface[] = [
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

// 默认API订阅列表
const DEFAULT_SUBSCRIPTIONS: APISubscription[] = []

// 生成唯一ID
const generateId = () => Date.now().toString() + Math.random()

// 定义Store的状态和方法
interface APIInterfacesState {
  // API接口列表
  interfaces: APIInterface[]
  
  // API订阅列表
  subscriptions: APISubscription[]
  
  // 操作方法 - API接口
  addInterface: (apiInterface: Omit<APIInterface, 'id'>) => void
  updateInterface: (id: string, apiInterface: Partial<Omit<APIInterface, 'id'>>) => void
  deleteInterface: (id: string) => void
  
  // 操作方法 - API订阅
  addSubscription: (subscription: APISubscription) => void
  addSubscriber: (apiEndpoint: string, systemId: string, systemName: string) => void
  removeSubscriber: (apiEndpoint: string, systemId: string) => void
  
  // 重置方法
  resetInterfaces: () => void
  resetSubscriptions: () => void
}

// 创建Store
export const useAPIInterfacesStore = create<APIInterfacesState>()(
  persist(
    (set, get) => ({
      // 初始状态
      interfaces: DEFAULT_INTERFACES,
      subscriptions: DEFAULT_SUBSCRIPTIONS,
      
      // API接口相关方法
      addInterface: (apiInterface) => {
        const newInterface: APIInterface = {
          ...apiInterface,
          id: generateId()
        }
        
        set(state => ({
          interfaces: [...state.interfaces, newInterface]
        }))
      },
      
      updateInterface: (id, apiInterface) => {
        set(state => ({
          interfaces: state.interfaces.map(item => 
            item.id === id ? { ...item, ...apiInterface } : item
          )
        }))
      },
      
      deleteInterface: (id) => {
        set(state => ({
          interfaces: state.interfaces.filter(item => item.id !== id)
        }))
      },
      
      // API订阅相关方法
      addSubscription: (subscription) => {
        set(state => ({
          subscriptions: [...state.subscriptions, subscription]
        }))
      },
      
      addSubscriber: (apiEndpoint, systemId, systemName) => {
        set(state => {
          const existingSubscription = state.subscriptions.find(
            sub => sub.apiEndpoint === apiEndpoint
          )
          
          if (existingSubscription) {
            // 如果订阅已存在，添加新的订阅者
            return {
              subscriptions: state.subscriptions.map(sub => 
                sub.apiEndpoint === apiEndpoint
                  ? {
                      ...sub,
                      subscribers: [
                        ...sub.subscribers,
                        { systemId, systemName }
                      ]
                    }
                  : sub
              )
            }
          } else {
            // 如果订阅不存在，创建新的订阅
            return {
              subscriptions: [
                ...state.subscriptions,
                {
                  apiEndpoint,
                  subscribers: [{ systemId, systemName }]
                }
              ]
            }
          }
        })
      },
      
      removeSubscriber: (apiEndpoint, systemId) => {
        set(state => {
          const updatedSubscriptions = state.subscriptions.map(sub => {
            if (sub.apiEndpoint === apiEndpoint) {
              return {
                ...sub,
                subscribers: sub.subscribers.filter(
                  subscriber => subscriber.systemId !== systemId
                )
              }
            }
            return sub
          }).filter(sub => sub.subscribers.length > 0) // 移除没有订阅者的订阅
          
          return { subscriptions: updatedSubscriptions }
        })
      },
      
      // 重置方法
      resetInterfaces: () => {
        set({ interfaces: DEFAULT_INTERFACES })
      },
      
      resetSubscriptions: () => {
        set({ subscriptions: DEFAULT_SUBSCRIPTIONS })
      }
    }),
    {
      name: 'api-interfaces-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
) 