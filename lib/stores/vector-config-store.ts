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
        set({ defaultConfig: config })
      },
      
      getDefaultConfig: () => {
        return get().defaultConfig
      },

      clearDefaultConfig: () => {
        set({ defaultConfig: null })
      }
    }),
    {
      name: 'vector-config-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ defaultConfig: state.defaultConfig }),
    }
  )
) 