interface TaskMetadata {
  systemId?: string
  systemName?: string
  apiEndpoint?: string
}

export interface Task {
  id: string
  title: string
  description: string
  type: string
  assignee?: string
  status?: 'pending' | 'in_progress' | 'completed'
  parentTaskId?: string
  metadata?: TaskMetadata
  createdAt: string
}

interface CreateTaskParams {
  title: string
  description: string
  type: string
  assignee?: string
  status?: Task['status']
  parentTaskId?: string
  metadata?: TaskMetadata
}

const defaultRequirementTask: Task = {
  id: 'requirement-analysis',
  title: '原始需求分析',
  description: '输入您的初步需求想法，我们将帮助您逐步细化和完善它，形成完整的需求分析报告。',
  type: '需求管理',
  status: 'pending',
  assignee: 'system',
  createdAt: new Date().toISOString(),
}

const defaultRequirementBookTask: Task = {
  id: 'requirement-book',
  title: '需求衍化',
  description: '基于原始需求分析结果，生成结构化的需求书。',
  type: '需求管理',
  status: 'pending',
  assignee: 'system',
  createdAt: new Date().toISOString(),
}

// 模拟数据存储
let tasks: Task[] = [defaultRequirementTask, defaultRequirementBookTask]

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const task: Task = {
    id: `task_${Date.now()}`,
    ...params,
    createdAt: new Date().toISOString()
  }
  
  tasks.push(task)
  return task
}

export async function getTasks(): Promise<Task[]> {
  // 这里可以添加从后端获取任务的逻辑
  return tasks
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error('Task not found')
  
  tasks[index] = { ...tasks[index], ...updates }
  return tasks[index]
}

export async function deleteTask(id: string): Promise<void> {
  tasks = tasks.filter(t => t.id !== id)
} 