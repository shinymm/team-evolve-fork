export * from './test-case'
export * from './test-format'
export * from './generate-from-steps'
export * from './generate-summary'
export * from './optimize-summary'
export * from './generate-detail'
export * from './requirement-analysis'
export * from './requirement-edit-analysis'
export * from './requirement-book'
export * from './scene-boundary'
export * from './scene-requirement'
export * from './user-story-breakdown'
export * from './requirement-to-md'
export * from './requirement-to-test'
export * from './requirement-boundary-comparison'
export * from './requirement-terminology'
export * from './epic-discussion'
export * from './user-persona'
export * from './architecture-suggestion'
export * from './exception-analysis'
export * from './requirement-architecture'

export function replaceTemplateVariables<T extends { [key: string]: string }>(template: string, variables: T): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  return result
} 