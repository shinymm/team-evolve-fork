export interface ArchitectureItem {
  id: string
  title: string
  description: string
  children?: ArchitectureItem[]
}

export interface UserPersona {
  id: string
  title: string
  features: string
  needs: string
}

export interface ProductInfo {
  id: string
  systemId: string
  overview: string
  userPersona: UserPersona[]
  architecture: ArchitectureItem[]
  createdAt: string
  updatedAt: string
}

export interface ArchitectureSuggestion {
  id: string
  title: string
  description: string
  action: 'add' | 'update' | 'delete'
  parentId?: string
  targetId?: string
} 