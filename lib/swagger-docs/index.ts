import { chatApiSpec } from './chat'
import { outcallTaskApiSpec } from './outcall_task'

export const swaggerDocs = {
  '/api/v1/chat': chatApiSpec,
  '/api/v1/outcall/tasks': outcallTaskApiSpec,
  // 未来可以继续添加其他接口文档
} as const

export type SwaggerDocs = typeof swaggerDocs 