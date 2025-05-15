// 定义接口
export interface RequirementActionRecord {
  id: string
  type: 'edit' | 'analyze' | 'other'
  systemId: string
  duration: number
  contentBefore?: string
  contentAfter?: string
  timestamp: string
  processed: boolean
}

// 数据库记录类型定义
interface DbRequirementAction {
  id: string
  type: string
  systemId: string
  duration: number
  contentBefore: string | null
  contentAfter: string | null
  timestamp: Date
  processed: boolean
}

/**
 * 记录需求动作
 * 通过API将动作记录到数据库
 */
export async function recordRequirementAction(
  systemId: string,
  action: {
    type: 'edit' | 'analyze' | 'other', 
    duration: number,
    contentBefore?: string,
    contentAfter?: string
  }
) {
  try {
    // 通过API调用
    const response = await fetch('/api/requirement-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemId,
        type: action.type,
        duration: action.duration,
        contentBefore: action.contentBefore,
        contentAfter: action.contentAfter,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API错误(${response.status}): ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('记录需求动作失败:', error);
    throw error;
  }
}

/**
 * 获取未处理的需求动作
 */
export async function getUnprocessedActions() {
  try {
    const response = await fetch('/api/requirement-actions?processed=false&type=edit');
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API错误(${response.status}): ${errorData.error || response.statusText}`);
    }
    
    const actions = await response.json();
    return actions;
  } catch (error) {
    console.error('获取未处理记录失败:', error);
    return [];
  }
}

/**
 * 标记需求动作为已处理
 */
export async function markActionAsProcessed(actionId: string) {
  try {
    const response = await fetch(`/api/requirement-actions?id=${actionId}`, {
      method: 'PATCH',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API错误(${response.status}): ${errorData.error || response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`标记动作失败: ${actionId}`, error);
    throw error;
  }
} 