// export * from './requirements-book' // 找不到模块
// export * from './requirements-evolution' // 找不到模块
export * from './test-case'
export * from './test-format'
export * from './generate-from-steps'
export * from './generate-summary'
export * from './optimize-summary'
export * from './generate-detail'
export * from './scene-boundary'
export * from './scene-requirement'
export * from './user-story-breakdown'

export function replaceTemplateVariables<T extends { [key: string]: string }>(template: string, variables: T): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
} 