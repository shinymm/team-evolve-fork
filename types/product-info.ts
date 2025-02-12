export interface ArchitectureItem {
  id: string
  title: string
  description: string
  parentId?: string
  children?: ArchitectureItem[]
}

export interface Overview {
  title: string
  content: string
}

export interface UserNeedsItem {
  id: string
  title: string
  features: string
  needs: string
}

export interface UserNeeds {
  title: string
  items: UserNeedsItem[]
}

export interface ProductInfo {
  architecture: ArchitectureItem[]
  overview: Overview
  userNeeds: UserNeeds
} 