import { createTask } from './task-service'

interface SystemSubscription {
  systemId: string
  systemName: string
  apiEndpoint: string
}

export async function handleNewSubscription(subscription: SystemSubscription) {
  // 1. 检查系统架构
  const architectureCheckTask = await createTask({
    title: `检查系统架构图 - ${subscription.systemName}`,
    description: `检查架构图中是否包含 ${subscription.systemName}(${subscription.systemId}) 与 QARE 的问答关联关系`,
    type: 'architecture',
    assignee: 'SaraQian',
    status: 'pending',
    metadata: {
      systemId: subscription.systemId,
      systemName: subscription.systemName,
      apiEndpoint: subscription.apiEndpoint
    }
  })

  // 2. 如果需要，创建架构更新任务
  if (await needsArchitectureUpdate(subscription)) {
    await createTask({
      title: `更新系统架构图 - 添加 ${subscription.systemName}`,
      description: `在高阶系统架构图中添加 ${subscription.systemName}(${subscription.systemId}) 与 QARE 的问答关联关系`,
      type: 'architecture',
      assignee: 'SaraQian',
      status: 'pending',
      parentTaskId: architectureCheckTask.id,
      metadata: {
        systemId: subscription.systemId,
        systemName: subscription.systemName,
        apiEndpoint: subscription.apiEndpoint
      }
    })
  }
}

async function needsArchitectureUpdate(subscription: SystemSubscription): Promise<boolean> {
  // 实现检查逻辑
  return true
} 