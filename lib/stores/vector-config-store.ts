import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// 从service中导入VectorModelConfig接口
import type { VectorModelConfig } from '../services/vector-config-service';

interface VectorConfigState {
  defaultConfig: VectorModelConfig | null;
  setDefaultConfig: (config: VectorModelConfig) => void;
  getDefaultConfig: () => VectorModelConfig | null;
  clearDefaultConfig: () => void;
}

export const useVectorConfigStore = create<VectorConfigState>()(
  persist(
    (set, get) => ({
      defaultConfig: null,
      
      setDefaultConfig: (config) => {
        console.log('设置默认配置:', config)
        set({ defaultConfig: config })
      },
      
      getDefaultConfig: () => {
        const config = get().defaultConfig
        console.log('获取默认配置:', config)
        return config
      },

      clearDefaultConfig: () => {
        console.log('清除默认配置')
        set({ defaultConfig: null })
      }
    }),
    {
      name: 'vector-config-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => {
        console.log('开始重新加载向量配置存储')
        return (state) => {
          console.log('向量配置存储已加载:', state?.defaultConfig)
        }
      }
    }
  )
) 