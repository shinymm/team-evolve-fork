import { Task } from './services/task-service'

export interface TaskAction {
  aiHelp: {
    route: string
    title: string
    description?: string
  }
  selfHelp?: {
    route: string
    title: string
    description?: string
  }
}

// 任务类型到动作的映射
export const taskActions: Record<string, TaskAction> = {
  'requirement-analysis': {
    aiHelp: {
      route: '/requirements/evolution',
      title: '需求分析',
      description: 'AI辅助分析需求，帮助细化和完善需求'
    },
    selfHelp: {
      route: '/requirements/evolution',
      title: '需求分析',
      description: '自助进行需求分析和完善'
    }
  },
  'boundary-analysis': {
    aiHelp: {
      route: '/requirements/boundary-analysis',
      title: '边界分析',
      description: 'AI辅助分析系统边界和接口定义'
    },
    selfHelp: {
      route: '/knowledge/boundary',
      title: '边界知识库',
      description: '查看系统边界相关的知识和最佳实践'
    }
  },
  // 未来可以添加更多任务类型
}

export function getTaskActions(task: Task): TaskAction | undefined {
  // 1. 首先通过任务ID精确匹配
  if (task.id in taskActions) {
    return taskActions[task.id]
  }
  
  // 2. 然后通过任务类型匹配
  if (task.type in taskActions) {
    return taskActions[task.type]
  }
  
  // 3. 如果都没有匹配到，返回 undefined
  return undefined
} 