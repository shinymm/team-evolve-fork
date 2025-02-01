import { chatApiSpec } from './chat'

export const swaggerDocs = {
  '/api/v1/chat': chatApiSpec,
  // 未来可以继续添加其他接口文档
} as const

export type SwaggerDocs = typeof swaggerDocs 