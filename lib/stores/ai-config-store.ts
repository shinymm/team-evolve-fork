import { create } from 'zustand'
import type { AIModelConfig } from '@/lib/ai-service'
import { getAIConfig, setAIConfig } from '@/lib/ai-config-service'

interface AIConfigStore {
  config: AIModelConfig | null
  setConfig: (config: AIModelConfig) => void
  initConfig: () => void
}

export const useAIConfigStore = create<AIConfigStore>((set) => ({
  config: null,
  setConfig: (config) => {
    setAIConfig(config)
    set({ config })
  },
  initConfig: () => {
    const config = getAIConfig()
    if (config) {
      set({ config })
    }
  }
})) 