interface ArchitectureItem {
  id: string
  title: string
  description: string
  parentId?: string
}

// 从 localStorage 获取信息架构数据
export const getArchitectureData = (): ArchitectureItem[] => {
  try {
    const data = localStorage.getItem('qare-architecture')
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error loading architecture data:', error)
    return []
  }
}

// 构建完整的路径信息
export const buildPathInfo = (items: ArchitectureItem[]): string => {
  const itemMap = new Map<string, ArchitectureItem>()
  items.forEach(item => itemMap.set(item.id, item))

  const getFullPath = (item: ArchitectureItem): string => {
    const path: string[] = []
    let current: ArchitectureItem | undefined = item
    
    while (current) {
      path.unshift(`${current.title}(${current.description})`)
      current = current.parentId ? itemMap.get(current.parentId) : undefined
    }
    
    return path.join(' > ')
  }

  const allPaths = items.map(item => getFullPath(item))
  return allPaths.join('\n')
}

// 获取格式化的信息架构内容
export const getFormattedArchitecture = (): string => {
  const items = getArchitectureData()
  if (!items.length) return ''

  return `
产品功能结构：
${buildPathInfo(items)}
`
} 