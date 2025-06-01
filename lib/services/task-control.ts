import { createTask } from './task-service'
import { StructuredRequirement } from './requirement-export-service'
import { ArchitectureSuggestion } from './architecture-suggestion-service'
import { Scene } from '@/types/requirement'

interface SystemSubscription {
  systemId: string
  systemName: string
  apiEndpoint: string
}

export interface RequirementData {
  reqBackground: string
  reqBrief: string
  scenes: Scene[]
}
