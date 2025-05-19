import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 单个系统的需求分析状态
interface SystemRequirementState {
  // 需求输入
  requirement: string
  
  // 固定的分析结果
  pinnedAnalysis: string | null
  
  // 需求书内容
  requirementBook: string | null
  
  // 固定的需求书内容
  pinnedRequirementBook: string | null
  
  // 是否已固定分析结果
  isPinned: boolean
  
  // 是否已固定需求书
  isRequirementBookPinned: boolean

  // 新增：图片生成的需求初稿
  imageDraft: string | null
}

// 定义需求分析Store的状态和方法
interface RequirementAnalysisState {
  // 当前选中的系统ID
  currentSystemId: string | null
  
  // 按系统ID存储的需求分析状态
  systemRequirements: Record<string, SystemRequirementState>
  
  // 是否正在加载
  isLoading: boolean
  
  // 错误信息
  error: string | null
  
  // 设置当前系统
  setCurrentSystem: (systemId: string) => void
  
  // 清除当前系统
  clearCurrentSystem: () => void
  
  // 设置需求
  setRequirement: (requirement: string) => void
  
  // 固定分析结果
  pinAnalysis: (analysis: string) => void
  
  // 取消固定分析结果
  unpinAnalysis: () => void
  
  // 清除固定的分析结果
  clearPinnedAnalysis: () => void
  
  // 需求书相关方法
  setRequirementBook: (book: string) => void
  clearRequirementBook: () => void
  pinRequirementBook: (book: string) => void
  unpinRequirementBook: () => void
  clearPinnedRequirementBook: () => void
  
  // 获取当前活跃的分析结果
  getActiveAnalysis: () => string | null
  
  // 获取当前活跃的需求书
  getActiveRequirementBook: () => string | null
  
  // 从Redis加载系统数据
  loadSystemDataFromRedis: (systemId: string) => Promise<void>
  
  // 保存系统数据到Redis
  saveSystemDataToRedis: (systemId: string) => Promise<void>
  
  // 清理非当前系统的缓存数据（保留近期使用的几个系统）
  cleanupCacheData: (keepRecentCount?: number) => void

  // 新增：设置图片生成的需求初稿
  setImageDraft: (draft: string) => void
  
  // 新增：清除图片生成的需求初稿
  clearImageDraft: () => void
}

// 创建一个空的系统状态
const createEmptySystemState = (): SystemRequirementState => ({
  requirement: '',
  pinnedAnalysis: null,
  requirementBook: null,
  pinnedRequirementBook: null,
  isPinned: false,
  isRequirementBookPinned: false,
  imageDraft: null
})

// 创建Store
export const useRequirementAnalysisStore = create<RequirementAnalysisState>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentSystemId: null,
      systemRequirements: {},
      isLoading: false,
      error: null,
      
      // 设置当前系统
      setCurrentSystem: (systemId) => {
        if (!systemId) return
        
        set({ currentSystemId: systemId })
        
        // 确保系统数据存在
        set((state) => {
          if (!state.systemRequirements[systemId]) {
            return {
              systemRequirements: {
                ...state.systemRequirements,
                [systemId]: createEmptySystemState()
              }
            }
          }
          return state
        })
        
        // 加载Redis数据
        get().loadSystemDataFromRedis(systemId)
      },
      
      // 清除当前系统
      clearCurrentSystem: () => {
        const { currentSystemId } = get()
        
        // 如果有当前系统，先保存到Redis
        if (currentSystemId) {
          get().saveSystemDataToRedis(currentSystemId)
            .catch(error => console.error('保存系统数据到Redis失败:', error))
        }
        
        set({ currentSystemId: null })
      },
      
      // 设置需求
      setRequirement: (requirement) => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              requirement
            }
          }
        }))
        
        // 添加自动保存延迟
        debouncedSaveToRedis(currentSystemId, get)
      },
      
      // 固定分析结果
      pinAnalysis: (analysis) => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              pinnedAnalysis: analysis,
              isPinned: true
            }
          }
        }))
        
        // 添加自动保存延迟
        debouncedSaveToRedis(currentSystemId, get)
      },
      
      // 取消固定分析结果
      unpinAnalysis: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              isPinned: false
            }
          }
        }))
      },
      
      // 清除固定的分析结果
      clearPinnedAnalysis: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              pinnedAnalysis: null,
              isPinned: false
            }
          }
        }))
      },
      
      // 设置需求书内容
      setRequirementBook: (book) => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              requirementBook: book
            }
          }
        }))
      },
      
      // 清除需求书内容
      clearRequirementBook: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              requirementBook: null
            }
          }
        }))
      },
      
      // 固定需求书内容
      pinRequirementBook: (book) => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              pinnedRequirementBook: book,
              isRequirementBookPinned: true
            }
          }
        }))
      },
      
      // 取消固定需求书
      unpinRequirementBook: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              isRequirementBookPinned: false
            }
          }
        }))
      },
      
      // 清除固定的需求书
      clearPinnedRequirementBook: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              pinnedRequirementBook: null,
              isRequirementBookPinned: false
            }
          }
        }))
      },
      
      // 获取当前活跃的分析结果
      getActiveAnalysis: () => {
        const { currentSystemId, systemRequirements } = get()
        if (!currentSystemId) return null
        
        const currentSystem = systemRequirements[currentSystemId]
        if (!currentSystem) return null
        
        return currentSystem.isPinned ? currentSystem.pinnedAnalysis : null
      },
      
      // 获取当前活跃的需求书
      getActiveRequirementBook: () => {
        const { currentSystemId, systemRequirements } = get()
        if (!currentSystemId) return null
        
        const currentSystem = systemRequirements[currentSystemId]
        if (!currentSystem) return null
        
        return currentSystem.isRequirementBookPinned ? currentSystem.pinnedRequirementBook : null
      },
      
      // 从Redis加载系统数据
      loadSystemDataFromRedis: async (systemId) => {
        if (!systemId) return
        
        // 检查localStorage是否已有该系统的数据
        const { systemRequirements } = get()
        const hasLocalData = !!systemRequirements[systemId]
        
        // 如果本地已有数据，则不需要从Redis加载
        if (hasLocalData) {
          console.log(`系统 ${systemId} 的需求分析数据已存在于本地缓存`)
          return
        }
        
        set({ isLoading: true, error: null })
        
        try {
          // 从服务器加载数据
          const response = await fetch(`/api/system-cache/${systemId}/requirement-analysis`)
          
          if (!response.ok) {
            // 如果找不到数据，则创建空状态
            if (response.status === 404) {
              set((state) => ({
                systemRequirements: {
                  ...state.systemRequirements,
                  [systemId]: createEmptySystemState()
                },
                isLoading: false
              }))
              console.log(`系统 ${systemId} 在Redis中无数据，已创建空状态`)
              return
            }
            
            throw new Error(`加载系统数据失败: ${response.statusText}`)
          }
          
          const data = await response.json()
          
          // 更新状态
          set((state) => ({
            systemRequirements: {
              ...state.systemRequirements,
              [systemId]: data.systemState || createEmptySystemState()
            },
            isLoading: false
          }))
          
          console.log(`已从Redis加载系统 ${systemId} 的需求分析数据`)
        } catch (error) {
          console.error('从Redis加载数据失败:', error)
          set({ 
            error: error instanceof Error ? error.message : '加载失败',
            isLoading: false
          })
        }
      },
      
      // 保存系统数据到Redis
      saveSystemDataToRedis: async (systemId) => {
        if (!systemId) return
        
        const { systemRequirements } = get()
        const systemData = systemRequirements[systemId]
        
        if (!systemData) {
          console.log(`系统 ${systemId} 没有数据可保存`)
          return
        }
        
        try {
          // 保存到服务器
          const response = await fetch(`/api/system-cache/${systemId}/requirement-analysis`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ systemState: systemData })
          })
          
          if (!response.ok) {
            throw new Error(`保存系统数据失败: ${response.statusText}`)
          }
          
          console.log(`已保存系统 ${systemId} 的需求分析数据到Redis`)
        } catch (error) {
          console.error('保存数据到Redis失败:', error)
          set({ error: error instanceof Error ? error.message : '保存失败' })
        }
      },
      
      // 清理非当前系统的缓存数据
      cleanupCacheData: (keepRecentCount = 3) => {
        const { currentSystemId, systemRequirements } = get()
        
        // 如果系统总数少于等于保留数量，则不需要清理
        const systemIds = Object.keys(systemRequirements)
        if (systemIds.length <= keepRecentCount) return
        
        // 获取访问时间戳（这里简化处理，实际使用中可能需要记录访问时间）
        // 在这个简化实现中，我们假设键的顺序就是访问顺序，最新的在前面
        // 实际实现时需要在每次访问系统时更新时间戳
        
        // 排除当前系统和最近使用的系统
        const systemsToKeep = new Set([currentSystemId])
        
        // 添加最近的几个系统（除了当前系统）
        systemIds.forEach(id => {
          if (id !== currentSystemId && systemsToKeep.size < keepRecentCount) {
            systemsToKeep.add(id)
          }
        })
        
        // 过滤掉要保留的系统，剩下的就是要清理的
        const systemsToRemove = systemIds.filter(id => !systemsToKeep.has(id))
        
        // 清理系统数据
        if (systemsToRemove.length > 0) {
          set((state) => {
            const newSystemRequirements = { ...state.systemRequirements }
            
            systemsToRemove.forEach(id => {
              // 在清理前，先保存到Redis
              get().saveSystemDataToRedis(id)
              
              // 从本地缓存中删除
              delete newSystemRequirements[id]
            })
            
            return { systemRequirements: newSystemRequirements }
          })
          
          console.log(`已清理 ${systemsToRemove.length} 个非活跃系统的本地缓存`)
        }
      },

      // 新增：设置图片生成的需求初稿
      setImageDraft: (draft) => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              imageDraft: draft
            }
          }
        }))
        debouncedSaveToRedis(currentSystemId, get)
      },
      
      // 新增：清除图片生成的需求初稿
      clearImageDraft: () => {
        const { currentSystemId } = get()
        if (!currentSystemId) return
        set((state) => ({
          systemRequirements: {
            ...state.systemRequirements,
            [currentSystemId]: {
              ...state.systemRequirements[currentSystemId],
              imageDraft: null
            }
          }
        }))
        debouncedSaveToRedis(currentSystemId, get)
      }
    }),
    {
      name: 'requirement-analysis-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只存储有限的数据到localStorage，减少存储压力
        currentSystemId: state.currentSystemId,
        systemRequirements: state.systemRequirements
      })
    }
  )
)

// 添加节流保存函数
let saveTimeouts: Record<string, NodeJS.Timeout> = {}

const debouncedSaveToRedis = (systemId: string, get: () => RequirementAnalysisState) => {
  if (typeof window === 'undefined') return
  
  // 清除之前的定时器
  if (saveTimeouts[systemId]) {
    clearTimeout(saveTimeouts[systemId])
  }
  
  // 设置新的定时器，5秒后保存
  saveTimeouts[systemId] = setTimeout(() => {
    get().saveSystemDataToRedis(systemId)
      .catch(error => console.error('自动保存到Redis失败:', error))
    
    // 清除已执行的定时器引用
    delete saveTimeouts[systemId]
  }, 5000)
}

// 添加页面关闭时保存
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useRequirementAnalysisStore.getState()
    const { currentSystemId } = state
    
    if (currentSystemId) {
      // 同步保存，确保数据不会丢失
      try {
        // 创建一个同步的fetch请求
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/system-cache/${currentSystemId}/requirement-analysis`, false) // false表示同步请求
        xhr.setRequestHeader('Content-Type', 'application/json')
        
        const systemData = state.systemRequirements[currentSystemId]
        if (systemData) {
          xhr.send(JSON.stringify({ systemState: systemData }))
        }
      } catch (error) {
        console.error('页面关闭时保存失败:', error)
      }
    }
  })
} 