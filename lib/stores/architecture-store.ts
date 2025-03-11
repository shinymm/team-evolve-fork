import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { highLevelArchitecture as defaultHighLevelArchitecture } from '@/lib/plantuml-templates/high-level'
import { microserviceArchitecture as defaultMicroserviceArchitecture } from '@/lib/plantuml-templates/microservice'
import { deploymentArchitecture as defaultDeploymentArchitecture } from '@/lib/plantuml-templates/deployment'

export type ArchitectureType = 'high-level' | 'microservice' | 'deployment'

interface ArchitectureState {
  architectures: Record<ArchitectureType, string>
  
  // 操作方法
  updateArchitecture: (type: ArchitectureType, content: string) => void
  resetArchitecture: (type: ArchitectureType) => void
  resetAllArchitectures: () => void
}

export const useArchitectureStore = create<ArchitectureState>()(
  persist(
    (set) => ({
      architectures: {
        'high-level': defaultHighLevelArchitecture,
        'microservice': defaultMicroserviceArchitecture,
        'deployment': defaultDeploymentArchitecture
      },

      updateArchitecture: (type, content) => {
        set((state) => ({
          architectures: {
            ...state.architectures,
            [type]: content
          }
        }))
      },

      resetArchitecture: (type) => {
        set((state) => ({
          architectures: {
            ...state.architectures,
            [type]: type === 'high-level' 
              ? defaultHighLevelArchitecture 
              : type === 'microservice' 
                ? defaultMicroserviceArchitecture 
                : defaultDeploymentArchitecture
          }
        }))
      },

      resetAllArchitectures: () => {
        set({
          architectures: {
            'high-level': defaultHighLevelArchitecture,
            'microservice': defaultMicroserviceArchitecture,
            'deployment': defaultDeploymentArchitecture
          }
        })
      }
    }),
    {
      name: 'architecture-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
) 