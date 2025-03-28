import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 定义需求分析Store的状态和方法
interface RequirementAnalysisState {
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
  
  // 操作方法
  setRequirement: (requirement: string) => void
  pinAnalysis: (analysis: string) => void
  unpinAnalysis: () => void
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
}

// 创建Store
export const useRequirementAnalysisStore = create<RequirementAnalysisState>()(
  persist(
    (set, get) => ({
      // 初始状态
      requirement: '',
      pinnedAnalysis: null,
      requirementBook: null,
      pinnedRequirementBook: null,
      isPinned: false,
      isRequirementBookPinned: false,
      
      // 设置需求
      setRequirement: (requirement) => {
        set({ requirement })
      },
      
      // 固定分析结果
      pinAnalysis: (analysis) => {
        set({ 
          pinnedAnalysis: analysis,
          isPinned: true 
        })
      },
      
      // 取消固定分析结果
      unpinAnalysis: () => {
        set({ isPinned: false })
      },
      
      // 清除固定的分析结果
      clearPinnedAnalysis: () => {
        set({ 
          pinnedAnalysis: null,
          isPinned: false 
        })
      },
      
      // 设置需求书内容
      setRequirementBook: (book) => {
        set({ requirementBook: book })
      },
      
      // 清除需求书内容
      clearRequirementBook: () => {
        set({ requirementBook: null })
      },
      
      // 固定需求书内容
      pinRequirementBook: (book) => {
        set({
          pinnedRequirementBook: book,
          isRequirementBookPinned: true
        })
      },
      
      // 取消固定需求书
      unpinRequirementBook: () => {
        set({ isRequirementBookPinned: false })
      },
      
      // 清除固定的需求书
      clearPinnedRequirementBook: () => {
        set({
          pinnedRequirementBook: null,
          isRequirementBookPinned: false
        })
      },
      
      // 获取当前活跃的分析结果
      getActiveAnalysis: () => {
        const { pinnedAnalysis, isPinned } = get()
        return isPinned ? pinnedAnalysis : null
      },
      
      // 获取当前活跃的需求书
      getActiveRequirementBook: () => {
        const { pinnedRequirementBook, isRequirementBookPinned } = get()
        return isRequirementBookPinned ? pinnedRequirementBook : null
      }
    }),
    {
      name: 'requirement-analysis-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
) 