import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface System {
  id: string
  name: string
  description?: string
  status?: string
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
}

interface SystemState {
  systems: System[]
  selectedSystemId: string | null
  isLoading: boolean
  error: string | null
  
  // 操作方法
  setSystems: (systems: System[]) => void
  setSelectedSystem: (system: System) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // API方法
  fetchSystems: () => Promise<void>
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set, get) => ({
      systems: [],
      selectedSystemId: null,
      isLoading: false,
      error: null,
      
      setSystems: (systems) => set({ systems }),
      setSelectedSystem: (system) => set({ selectedSystemId: system.id }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      fetchSystems: async () => {
        try {
          console.log('开始获取系统列表...')
          set({ isLoading: true, error: null })
          const response = await fetch('/api/systems')
          
          console.log('API响应状态:', response.status)
          if (!response.ok) {
            const errorData = await response.json()
            console.error('API错误:', errorData)
            throw new Error(errorData.error || '获取系统列表失败')
          }
          
          const data = await response.json()
          console.log('获取到的系统数据:', {
            count: data.length,
            systems: data
          })
          
          set({ systems: data })
          
          // 如果有系统数据但没有选中的系统，自动选择第一个
          if (data.length > 0 && !get().selectedSystemId) {
            console.log('自动选择第一个系统:', data[0])
            set({ selectedSystemId: data[0].id })
          }
        } catch (error) {
          console.error('获取系统列表失败:', error)
          set({ error: error instanceof Error ? error.message : '未知错误' })
        } finally {
          set({ isLoading: false })
        }
      }
    }),
    {
      name: 'system-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
) 