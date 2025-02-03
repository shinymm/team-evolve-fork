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
  assignee: 'SQ',
  createdAt: new Date().toISOString(),
}

const defaultRequirementBookTask: Task = {
  id: 'requirement-book',
  title: '需求初稿衍化',
  description: '基于原始需求分析结果，生成需求书初稿。',
  type: '需求管理',
  status: 'pending',
  assignee: 'SQ',
  createdAt: new Date().toISOString(),
}

// 检查是否在浏览器环境中
const isBrowser = typeof window !== 'undefined'

// 模拟数据存储
let tasks: Task[] = []

// 从 localStorage 加载任务
function loadTasks() {
  try {
    if (isBrowser) {
      const savedTasks = localStorage.getItem('qare-tasks')
      if (savedTasks) {
        tasks = JSON.parse(savedTasks)
        return
      }
    }
    // 只有在没有保存的任务时才使用默认任务
    tasks = [
      { ...defaultRequirementTask, createdAt: new Date().toISOString() },
      { ...defaultRequirementBookTask, createdAt: new Date().toISOString() }
    ]
    // 只在浏览器环境中保存到 localStorage
    if (isBrowser) {
      saveTasks()
    }
  } catch (error) {
    console.error('Failed to load tasks:', error)
    tasks = [
      { ...defaultRequirementTask, createdAt: new Date().toISOString() },
      { ...defaultRequirementBookTask, createdAt: new Date().toISOString() }
    ]
    if (isBrowser) {
      saveTasks()
    }
  }
}

// 保存任务到 localStorage
function saveTasks() {
  if (!isBrowser) return
  
  try {
    localStorage.setItem('qare-tasks', JSON.stringify(tasks))
  } catch (error) {
    console.error('Failed to save tasks:', error)
  }
}

// 初始化加载任务
loadTasks()

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const task: Task = {
    id: `task_${Date.now()}`,
    ...params,
    createdAt: new Date().toISOString()
  }
  
  tasks.push(task)
  if (isBrowser) {
    saveTasks()
  }
  return task
}

export async function getTasks(): Promise<Task[]> {
  return tasks
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const index = tasks.findIndex(t => t.id === id)
  if (index === -1) throw new Error('Task not found')
  
  tasks[index] = { ...tasks[index], ...updates }
  if (isBrowser) {
    saveTasks()
  }
  return tasks[index]
}

export async function deleteTask(id: string): Promise<void> {
  tasks = tasks.filter(t => t.id !== id)
  if (isBrowser) {
    saveTasks()
  }
} 