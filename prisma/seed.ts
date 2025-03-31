import { PrismaClient } from '@prisma/client'
import { APIInterface } from '@/lib/stores/api-interfaces-store'
import { highLevelArchitecture } from '@/lib/plantuml-templates/high-level'
import { microserviceArchitecture } from '@/lib/plantuml-templates/microservice'
import { deploymentArchitecture } from '@/lib/plantuml-templates/deployment'
import { 
  DEFAULT_ARCHITECTURE,
  DEFAULT_OVERVIEW,
  DEFAULT_USER_NEEDS
} from '@/lib/services/product-info-service'
import { chatApiSpec } from '@/lib/swagger-docs/chat'
import { outcallTaskApiSpec } from '@/lib/swagger-docs/outcall_task'

// 默认API接口列表
const DEFAULT_INTERFACES: (APIInterface & { swaggerDoc: any })[] = [
  {
    id: '1',
    name: '文本机器人对话接口',
    description: '提供文本机器人的对话功能，支持流式返回和一次性返回两种模式',
    type: 'REST',
    endpoint: '/api/v1/chat',
    operation: 'POST',
    swaggerEndpoint: '/api/v1/chat',
    swaggerDoc: chatApiSpec
  },
  {
    id: '2',
    name: '外呼任务下发接口',
    description: '提供外呼任务的下发功能',
    type: 'REST',
    endpoint: '/api/v1/outcall/tasks',
    operation: 'POST',
    swaggerEndpoint: '/api/v1/outcall/tasks',
    swaggerDoc: outcallTaskApiSpec
  }
]

const prisma = new PrismaClient()

async function main() {
  // 创建QARE系统
  const system = await prisma.system.create({
    data: {
      name: 'QARE',
      description: '智能客户服务平台，专为现代企业设计，旨在通过先进的AI技术提升客户服务效率和体验。',
      createdBy: 'system',
      // 创建产品信息
      productInfo: {
        create: {
          overview: DEFAULT_OVERVIEW.content,
          userPersona: DEFAULT_USER_NEEDS.items.map(item => ({
            title: item.title,
            features: item.features,
            needs: item.needs
          })),
          architecture: JSON.parse(JSON.stringify(DEFAULT_ARCHITECTURE))
        }
      },
      // 创建系统架构
      architecture: {
        create: {
          highLevel: highLevelArchitecture,
          microservice: microserviceArchitecture,
          deployment: deploymentArchitecture
        }
      }
    }
  })

  // 创建API接口
  await Promise.all(
    DEFAULT_INTERFACES.map((api) => 
      prisma.aPIInterface.create({
        data: {
          systemId: system.id,
          name: api.name,
          description: api.description,
          type: api.type,
          endpoint: api.endpoint,
          operation: api.operation,
          swaggerEndpoint: api.swaggerEndpoint,
          swaggerDoc: api.swaggerDoc
        }
      })
    )
  )

  console.log('数据迁移完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 