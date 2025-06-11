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
  clearSelectedSystem: () => void
  clearSystems: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // API方法
  fetchSystems: () => Promise<void>
}

const initialState = {
  systems: [],
  selectedSystemId: null,
  isLoading: false,
  error: null,
}

export const useSystemStore = create<SystemState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setSystems: (systems) => set({ systems }),
      setSelectedSystem: (system) => set({ selectedSystemId: system.id }),
      clearSelectedSystem: () => set({ selectedSystemId: null }),
      clearSystems: () => {
        set(initialState)
        // 手动清除localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('system-storage')
        }
      },
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
            // 如果是未授权错误，清空所有状态
            if (response.status === 401) {
              set(initialState)
              // 手动清除localStorage
              if (typeof window !== 'undefined') {
                localStorage.removeItem('system-storage')
              }
              return
            }
            throw new Error(errorData.error || '获取系统列表失败')
          }
          
          const data = await response.json()
          console.log('获取到的系统数据:', {
            count: data.length,
            systems: data
          })
          
          set({ systems: data })
          
          // 如果当前选中的系统不在列表中，清除选中状态
          const selectedSystemId = get().selectedSystemId
          if (selectedSystemId && !data.find((s: System) => s.id === selectedSystemId)) {
            set({ selectedSystemId: null })
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        systems: state.systems,
        selectedSystemId: state.selectedSystemId
      })
    }
  )
) 