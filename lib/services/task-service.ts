interface TaskMetadata {
  systemId: string
  systemName: string
  apiEndpoint: string
}

export interface Task {
  id: string
  title: string
  description: string
  type: string
  assignee: string
  status: 'pending' | 'in_progress' | 'completed'
  parentTaskId?: string
  metadata?: TaskMetadata
  createdAt: string
}

interface CreateTaskParams {
  title: string
  description: string
  type: string
  assignee: string
  status: Task['status']
  parentTaskId?: string
  metadata?: TaskMetadata
}

// 模拟数据存储
let tasks: Task[] = []

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