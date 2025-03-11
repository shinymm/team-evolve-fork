import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ArchitectureItem, Overview, UserNeeds, UserNeedsItem } from '@/types/product-info'
import { 
  DEFAULT_ARCHITECTURE, 
  DEFAULT_OVERVIEW, 
  DEFAULT_USER_NEEDS,
  buildArchitectureTree as buildTree,
  generateArchitectureId
} from '@/lib/services/product-info-service'

// 定义Store的状态和方法
interface ProductInfoState {
  // 信息架构树
  flatArchitecture: ArchitectureItem[]
  
  // 电梯演讲（概述）
  overview: Overview
  
  // 用户画像（需求）
  userNeeds: UserNeeds
  
  // 操作方法 - 信息架构
  addArchitectureItem: (title: string, description: string, parentId?: string) => void
  updateArchitectureItem: (id: string, title: string, description: string) => void
  deleteArchitectureItem: (id: string) => void
  getArchitectureTree: () => ArchitectureItem[]
  
  // 操作方法 - 概述
  updateOverview: (newOverview: Overview) => void
  
  // 操作方法 - 用户需求
  addUserNeed: (title: string, features: string, needs: string) => void
  updateUserNeed: (id: string, title: string, features: string, needs: string) => void
  deleteUserNeed: (id: string) => void
  updateUserNeedsOverview: (title: string) => void
}

// 创建Store
export const useProductInfoStore = create<ProductInfoState>()(
  persist(
    (set, get) => ({
      // 初始状态 - 使用service中的默认值
      flatArchitecture: DEFAULT_ARCHITECTURE,
      overview: DEFAULT_OVERVIEW,
      userNeeds: DEFAULT_USER_NEEDS,
      
      // 信息架构相关方法
      addArchitectureItem: (title, description, parentId) => {
        const newItem: ArchitectureItem = {
          id: generateArchitectureId(parentId),
          title,
          description,
          parentId
        }
        
        set(state => ({
          flatArchitecture: [...state.flatArchitecture, newItem]
        }))
      },
      
      updateArchitectureItem: (id, title, description) => {
        set(state => ({
          flatArchitecture: state.flatArchitecture.map(item =>
            item.id === id ? { ...item, title, description } : item
          )
        }))
      },
      
      deleteArchitectureItem: (id) => {
        set(state => ({
          flatArchitecture: state.flatArchitecture.filter(item => 
            item.id !== id && item.parentId !== id
          )
        }))
      },
      
      getArchitectureTree: () => {
        return buildTree(get().flatArchitecture)
      },
      
      // 概述相关方法
      updateOverview: (newOverview) => {
        set({ overview: newOverview })
      },
      
      // 用户需求相关方法
      addUserNeed: (title, features, needs) => {
        const newItem: UserNeedsItem = {
          id: String(new Date().getTime()),
          title,
          features,
          needs
        }
        
        set(state => ({
          userNeeds: {
            ...state.userNeeds,
            items: [...state.userNeeds.items, newItem]
          }
        }))
      },
      
      updateUserNeed: (id, title, features, needs) => {
        set(state => ({
          userNeeds: {
            ...state.userNeeds,
            items: state.userNeeds.items.map(item =>
              item.id === id ? { ...item, title, features, needs } : item
            )
          }
        }))
      },
      
      deleteUserNeed: (id) => {
        set(state => ({
          userNeeds: {
            ...state.userNeeds,
            items: state.userNeeds.items.filter(item => item.id !== id)
          }
        }))
      },
      
      updateUserNeedsOverview: (title) => {
        set(state => ({
          userNeeds: {
            ...state.userNeeds,
            title
          }
        }))
      }
    }),
    {
      name: 'product-info-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
) 