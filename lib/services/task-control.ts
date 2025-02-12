import { createTask } from './task-service'
import { StructuredRequirement } from './requirement-export-service'
import { ArchitectureSuggestion } from './architecture-suggestion-service'

interface SystemSubscription {
  systemId: string
  systemName: string
  apiEndpoint: string
}

interface RequirementData {
  reqBackground: string
  reqBrief: string
  scenes: {
    name: string
    overview: string
    userJourney: string[]
  }[]
}

export async function createRequirementStructureTask(mdContent: string) {
  return await createTask({
    title: '需求书结构化',
    description: '将需求书内容解析为结构化数据，便于后续分析',
    type: 'requirement-structure',
    assignee: 'system',
    status: 'pending',
    metadata: {
      mdContent
    }
  })
}

export async function createSceneAnalysisTask(requirementData: RequirementData) {
  return await createTask({
    title: '场景边界分析',
    description: '基于结构化的需求数据，分析每个场景的边界条件',
    type: 'scene-analysis',
    assignee: 'SQ',
    status: 'pending',
    metadata: {
      requirementData
    }
  })
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

export async function createArchitectureSuggestionTask(requirement: StructuredRequirement) {
  return await createTask({
    title: '产品知识更新建议',
    description: '基于需求内容，分析并提供产品架构的调整建议',
    type: 'architecture-suggestion',
    assignee: 'system',
    status: 'pending',
    metadata: {
      requirement
    }
  })
}

export async function createArchitectureConfirmTask(suggestions: ArchitectureSuggestion[]) {
  return await createTask({
    title: '产品知识更新确认',
    description: '请确认AI提供的产品架构调整建议',
    type: 'architecture-confirm',
    assignee: 'SQ',
    status: 'pending',
    metadata: {
      suggestions
    }
  })
} 