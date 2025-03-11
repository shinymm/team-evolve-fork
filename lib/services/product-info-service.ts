import { ArchitectureItem, Overview, UserNeeds, ProductInfo } from '@/types/product-info'

export const DEFAULT_ARCHITECTURE: ArchitectureItem[] = [
  { "id": "1", "title": "知识引擎", "description": "支持意图管理、知识管理、脚本维护及更新记录等功能模块" },
  { "id": "1-1", "parentId": "1", "title": "意图", "description": "支持用户和系统意图的管理与识别" },
  { "id": "1-2", "parentId": "1", "title": "实体", "description": "用户或系统数据的结构化实体定义和管理" },
  { "id": "1-3", "parentId": "1", "title": "闲聊", "description": "提供系统与用户之间的非任务型对话能力" },
  { "id": "1-4", "parentId": "1", "title": "剧本", "description": "设计对话流程与任务剧本的模块" },
  { "id": "1-5", "parentId": "1", "title": "表格/知识图谱", "description": "用于定义和展示知识表格及知识图谱" },
  { "id": "1-6", "parentId": "1", "title": "知识分享", "description": "支持知识共享与协同的功能" },
  { "id": "1-7", "parentId": "1", "title": "更新记录", "description": "对知识和意图变更的记录管理" },

  { "id": "2", "title": "机器人管理", "description": "包含机器人创建、配置、部署等生命周期管理功能" },
  { "id": "2-1", "parentId": "2", "title": "机器人创建", "description": "支持文本、外呼、语音和agent类型机器人的创建" },
  { "id": "2-2", "parentId": "2", "title": "机器人配置", "description": "包括知识、脚本、全局异常及模型相关参数配置" },
  { "id": "2-3", "parentId": "2", "title": "机器人部署", "description": "机器人上下线的管理" },

  { "id": "3", "title": "文档管理", "description": "支持文档上传、删除和检索等功能" },
  { "id": "3-1", "parentId": "3", "title": "上传/删除", "description": "提供文档的上传与删除管理" },
  { "id": "3-2", "parentId": "3", "title": "搜索", "description": "通过文档内容检索相关信息" },

  { "id": "4", "title": "模型训练", "description": "支持从数据集到模型的完整训练管理" },
  { "id": "4-1", "parentId": "4", "title": "数据集管理", "description": "对模型训练所需的数据集进行管理" },
  { "id": "4-2", "parentId": "4", "title": "训练集/测试集", "description": "训练和测试数据的管理模块" },
  { "id": "4-3", "parentId": "4", "title": "意图分类", "description": "支持意图数据的分类与整理" },
  { "id": "4-4", "parentId": "4", "title": "推荐相似问题", "description": "提供问题相似度分析与推荐功能" },

  { "id": "5", "title": "语音产品", "description": "面向语音外呼和TTS功能的管理模块" },
  { "id": "5-1", "parentId": "5", "title": "智能外呼", "description": "语音外呼任务的创建与管理" },
  { "id": "5-2", "parentId": "5", "title": "外呼任务", "description": "外呼任务的策略配置和执行监控" },
  { "id": "5-3", "parentId": "5", "title": "录音中心", "description": "支持录音上传、下线、发布等管理" },
  { "id": "5-4", "parentId": "5", "title": "TTS语音合成引擎", "description": "语音合成和情感表达相关功能" },

  { "id": "6", "title": "运营工具", "description": "包含模型效果评测、测试集管理、巡检任务等功能模块" },
  { "id": "6-1", "parentId": "6", "title": "模型效果测评", "description": "提供对对话过程模型效果的测评能力" },
  { "id": "6-2", "parentId": "6", "title": "巡检任务", "description": "任务完成后的数据巡检工具" },
  { "id": "6-3", "parentId": "6", "title": "文本聚类", "description": "对对话和数据进行聚类分析" },
  { "id": "6-4", "parentId": "6", "title": "消息级标注", "description": "支持消息的标注与质量检测" },
  { "id": "6-5", "parentId": "6", "title": "会话级标注", "description": "支持会话的标注与质量检测" },
  { "id": "6-6", "parentId": "6", "title": "歧义教育标注", "description": "支持歧义的标注与质量检测" },
  { "id": "6-7", "parentId": "6", "title": "预警监控中心", "description": "预警与监控的面板" },

  { "id": "7", "title": "数据看板", "description": "提供实时数据的可视化展示功能" },
  { "id": "7-1", "parentId": "7", "title": "数据概览", "description": "展示核心数据的总览信息" },
  { "id": "7-2", "parentId": "7", "title": "会话纬度", "description": "从会话角度展示数据统计" },
  { "id": "7-3", "parentId": "7", "title": "意图纬度", "description": "以意图为核心展示相关数据" },

  { "id": "8", "title": "系统监控", "description": "负责系统模型、资源、任务和数据的监控与预警" },
  { "id": "8-1", "parentId": "8", "title": "模型监控", "description": "对模型训练和使用情况的监控" },
  { "id": "8-2", "parentId": "8", "title": "任务监控", "description": "对任务执行状态的监控" },
  { "id": "8-3", "parentId": "8", "title": "数据监控", "description": "提供数据使用与变化的监控能力" },

  { "id": "9", "title": "运营后台统一登陆", "description": "支持运营用户使用有效的用户名和密码进行登录，并提供重置密码的选项" }
]

export const DEFAULT_OVERVIEW: Overview = {
  title: "产品电梯演讲",
  content: "智能客户服务平台，专为现代企业设计，旨在通过先进的AI技术提升客户服务效率和体验。\n\n本系统集成了文本和语音机器人，支持从简单的问答到复杂的外呼任务，无论是零售客户、对公机构还是内部员工，都能通过手机银行、对公网银或内部系统无缝接入。我们的系统不仅能够处理日常查询，还能进行智能外呼和语音导航，极大地减轻了人工坐席的负担。此外，系统还具备强大的知识管理和运营工具，支持从知识库和图谱中提取信息，通过模型训练和数据分析不断优化对话质量。我们的数据看板和系统监控功能确保所有操作透明可控，帮助企业实时监控服务质量和系统性能。"
}

export const DEFAULT_USER_NEEDS: UserNeeds = {
  title: "核心用户与需求",
  items: [
    {
      id: "1",
      title: "渠道问答用户群体",
      features: "包括零售客户、对公机构客户及内部员工，通常对服务的即时性和准确性有较高要求。",
      needs: "希望获得快速、准确的答案，并对服务质量有反馈渠道。"
    },
    {
      id: "2",
      title: "运营配置团队",
      features: "一线运营人员，负责机器人及知识库的配置和管理。",
      needs: "需要简单易用的工具进行配置，快速响应业务需求变化。"
    },
    {
      id: "3",
      title: "客户经营与数据分析用户群体",
      features: "客户经理、数据分析师，关注客户满意度及服务质量的提升。",
      needs: "希望获取详细的满意度数据和分析报告，以支持业务决策。"
    },
    {
      id: "4",
      title: "会话质检群体",
      features: "负责会话数据分析的质检员，关注服务质量和客户反馈。",
      needs: "需要系统化的数据分析工具来评估服务质量。"
    }
  ]
}

const STORAGE_KEYS = {
  ARCHITECTURE: 'qare-architecture',
  OVERVIEW: 'qare-overview',
  USER_NEEDS: 'qare-user-needs'
}

export const getProductInfo = (): ProductInfo => {
  try {
    const architectureData = localStorage.getItem(STORAGE_KEYS.ARCHITECTURE)
    const overviewData = localStorage.getItem(STORAGE_KEYS.OVERVIEW)
    const userNeedsData = localStorage.getItem(STORAGE_KEYS.USER_NEEDS)

    return {
      architecture: architectureData ? JSON.parse(architectureData) : DEFAULT_ARCHITECTURE,
      overview: overviewData ? JSON.parse(overviewData) : DEFAULT_OVERVIEW,
      userNeeds: userNeedsData ? JSON.parse(userNeedsData) : DEFAULT_USER_NEEDS
    }
  } catch (error) {
    console.error('Error loading product info:', error)
    return {
      architecture: DEFAULT_ARCHITECTURE,
      overview: DEFAULT_OVERVIEW,
      userNeeds: DEFAULT_USER_NEEDS
    }
  }
}

export const saveArchitecture = (architecture: ArchitectureItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEYS.ARCHITECTURE, JSON.stringify(architecture))
  } catch (error) {
    console.error('Error saving architecture:', error)
  }
}

export const saveOverview = (overview: Overview) => {
  try {
    localStorage.setItem(STORAGE_KEYS.OVERVIEW, JSON.stringify(overview))
  } catch (error) {
    console.error('Error saving overview:', error)
  }
}

export const saveUserNeeds = (userNeeds: UserNeeds) => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_NEEDS, JSON.stringify(userNeeds))
  } catch (error) {
    console.error('Error saving user needs:', error)
  }
}

// 构建完整的架构路径信息
export const buildArchitecturePaths = (items: ArchitectureItem[]): string => {
  const itemMap = new Map<string, ArchitectureItem>()
  items.forEach(item => itemMap.set(item.id, item))

  const getFullPath = (item: ArchitectureItem): string => {
    const path: string[] = []
    let current: ArchitectureItem | undefined = item
    
    while (current) {
      path.unshift(`${current.title}(${current.description})`)
      current = current.parentId ? itemMap.get(current.parentId) : undefined
    }
    
    return path.join(' > ')
  }

  const allPaths = items.map(item => getFullPath(item))
  return allPaths.join('\n')
}

// 将扁平结构转换为树形结构
export const buildArchitectureTree = (items: ArchitectureItem[]): ArchitectureItem[] => {
  const itemMap = new Map<string, ArchitectureItem & { children?: ArchitectureItem[] }>()
  const result: ArchitectureItem[] = []

  // 首先创建所有节点的映射
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] })
  })

  // 构建树形结构
  items.forEach(item => {
    const node = itemMap.get(item.id)!
    if (item.parentId) {
      const parent = itemMap.get(item.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      }
    } else {
      result.push(node)
    }
  })

  return result
}

// 将树形结构转换回扁平结构
export const flattenArchitectureTree = (items: ArchitectureItem[]): ArchitectureItem[] => {
  const result: ArchitectureItem[] = []
  const flatten = (item: ArchitectureItem, parentId?: string) => {
    const flatItem = {
      id: item.id,
      title: item.title,
      description: item.description,
      parentId
    }
    result.push(flatItem)
    if ('children' in item && item.children) {
      item.children.forEach(child => flatten(child, item.id))
    }
  }
  items.forEach(item => flatten(item))
  return result
}

// 生成新的架构项ID
export const generateArchitectureId = (parentId?: string): string => {
  const timestamp = new Date().getTime()
  return parentId ? `${parentId}-${timestamp}` : `${timestamp}`
} 