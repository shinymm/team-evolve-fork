import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface VectorModelConfig {
  id?: string;
  name: string;
  baseURL: string;
  model: string;
  apiKey: string;
  isDefault?: boolean;
}

interface VectorConfigState {
  configs: VectorModelConfig[];
  addConfig: (config: VectorModelConfig) => void;
  updateConfig: (id: string, config: VectorModelConfig) => void;
  deleteConfig: (id: string) => void;
  setDefaultConfig: (id: string) => void;
  getConfig: (id: string) => VectorModelConfig | undefined;
  getDefaultConfig: () => VectorModelConfig | undefined;
}

export const useVectorConfigStore = create<VectorConfigState>()(
  persist(
    (set, get) => ({
      configs: [],
      
      addConfig: (config) => {
        const configToAdd = {
          ...config,
          id: config.id || Date.now().toString(),
        }
        
        console.log('添加配置:', configToAdd)
        
        set((state) => {
          // 如果新配置被设置为默认，则更新其他配置为非默认
          let updatedConfigs = state.configs.map(c => ({
            ...c,
            isDefault: configToAdd.isDefault ? false : c.isDefault
          }))
          
          const newConfigs = [...updatedConfigs, configToAdd]
          console.log('更新后的配置列表:', newConfigs)
          
          return { configs: newConfigs }
        })
      },
      
      updateConfig: (id, config) => {
        console.log('更新配置:', id, config)
        
        set((state) => {
          const updatedConfigs = state.configs.map((c) => 
            c.id === id ? { ...c, ...config } : c
          )
          console.log('更新后的配置列表:', updatedConfigs)
          return { configs: updatedConfigs }
        })
      },
      
      deleteConfig: (id) => {
        console.log('删除配置:', id)
        
        set((state) => {
          const configToDelete = state.configs.find(c => c.id === id)
          const updatedConfigs = state.configs.filter(c => c.id !== id)
          
          // 如果删除的是默认配置且还有其他配置，则将第一个配置设为默认
          if (configToDelete?.isDefault && updatedConfigs.length > 0) {
            updatedConfigs[0] = {
              ...updatedConfigs[0],
              isDefault: true
            }
          }
          
          console.log('更新后的配置列表:', updatedConfigs)
          return { configs: updatedConfigs }
        })
      },
      
      setDefaultConfig: (id) => {
        console.log('设置默认配置:', id)
        
        set((state) => {
          const updatedConfigs = state.configs.map((c) => ({
            ...c,
            isDefault: c.id === id
          }))
          console.log('更新后的配置列表:', updatedConfigs)
          return { configs: updatedConfigs }
        })
      },
      
      getConfig: (id) => {
        const config = get().configs.find((c) => c.id === id)
        console.log('获取配置:', id, config)
        return config
      },
      
      getDefaultConfig: () => {
        const config = get().configs.find((c) => c.isDefault)
        console.log('获取默认配置:', config)
        return config
      }
    }),
    {
      name: 'vector-config-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => {
        console.log('开始重新加载向量配置存储')
        return (state) => {
          console.log('向量配置存储已加载:', state?.configs)
          if (state?.configs) {
            const defaultConfig = state.configs.find(c => c.isDefault)
            console.log('默认配置:', defaultConfig)
          }
        }
      }
    }
  )
) 