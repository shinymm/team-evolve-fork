// 动作记录的接口定义
export interface RequirementActionRecord {
  id: string
  type: 'edit' | 'analyze' | 'other'
  duration: number  // 持续时间（秒）
  contentBefore?: string
  contentAfter?: string
  timestamp: string
  processed: boolean  // 是否已被提炼
}

const STORAGE_KEY = 'requirement-actions'

// 从 localStorage 获取所有动作记录
function getStoredActions(): RequirementActionRecord[] {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

// 保存动作记录到 localStorage
function saveActions(actions: RequirementActionRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions))
}

export async function recordRequirementAction(action: Omit<RequirementActionRecord, 'id' | 'timestamp' | 'processed'>) {
  const newAction: RequirementActionRecord = {
    ...action,
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    processed: false
  }

  const actions = getStoredActions()
  actions.push(newAction)
  saveActions(actions)

  return newAction
}

export async function getUnprocessedActions() {
  const actions = getStoredActions()
  return actions
    .filter(action => !action.processed)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export async function markActionAsProcessed(actionId: string) {
  const actions = getStoredActions()
  const updatedActions = actions.filter(action => action.id !== actionId)
  saveActions(updatedActions)
} 