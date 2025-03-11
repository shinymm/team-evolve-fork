import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { BoundaryRule } from '@/types/boundary'

// 默认规则
export const DEFAULT_RULES: Omit<BoundaryRule, 'id'>[] = [
  {
    checkItem: "规则条件不明确",
    scenario: "当涉及到规则条件",
    checkPoints: "1、检查规则条件是否明确，是否遗漏了规则条件项\n2、补充完整所有的规则条件项，列出各种条件组合下的Happy、Sad和Negative Case",
    example: "客户在跟机器人交互时新增图片发送功能",
    boundaryExample: "1、选择发送图片时，若图片格式不支持，如何处理？\n2、选择发送图片时，图片大小是否有限制？"
  },
  {
    checkItem: "规则条件的补充case",
    scenario: "当涉及到规则条件时",
    checkPoints: "1、对应规则条件不成立时的各种Negative Case\n2、如果是多个条件，使用决策表，识别没有考虑到的条件组合出现的Case",
    example: "每讲一篇故事消耗聊天次数*1",
    boundaryExample: "1、讲故事请求未成功或中途停止，是否消耗聊天次数？\n2、同一个故事讲多遍，如何消耗聊天次数？"
  },
  {
    checkItem: "规则边界值和极限值",
    scenario: "当涉及到规则条件时",
    checkPoints: "1、对应规则条件的默认值及处理逻辑\n2、对应规则条件刚好处于边界值或临界值的Case\n3、对应规则条件处于极限值的Case",
    example: "知识库检索结果置信度阈值为0.8，高于0.8则直接回复，低于0.8则转人工",
    boundaryExample: "1、置信度刚好为0.8时，如何处理？ 2、知识库中没有匹配结果（置信度为0）时，如何处理？ 3、用户输入超长文本（超出系统处理极限）时，如何处理？"
  },
  {
    checkItem: "逆向或反向操作",
    scenario: "当涉及到操作步骤时",
    checkPoints: "1、用户没有按预定的顺序，从后续步骤向前操作时的Case\n2、用户操作中途取消、回退的Case\n3、后提审核不通过、大会的Case（如涉审，后台自动审核未通过）",
    example: "用户在语音导航流程中，可以直接说\"返回上一级\"或\"取消\"来中断当前流程",
    boundaryExample: "1、用户在等待机器人回复时，连续多次发送消息，如何处理？ 2、用户在转人工排队过程中退出，再次进入是否需要重新排队？"
  },
  {
    checkItem: "并发操作",
    scenario: "当涉及到多用户或多线程操作时",
    checkPoints: "1、多个用户同时操作同一资源的Case\n2、用户在一个会话中同时进行多个操作的Case",
    example: "多个客服同时查看/编辑同一个知识点",
    boundaryExample: "1、两个客服同时编辑同一个知识点，如何处理冲突？\n2、用户在一个会话中同时发起多个查询，如何处理并发请求？"
  },
  {
    checkItem: "异常处理",
    scenario: "当涉及到系统异常时",
    checkPoints: "1、系统出现异常时的处理逻辑\n2、网络连接中断时的处理逻辑\n3、第三方服务不可用时的处理逻辑",
    example: "用户上传文件时网络中断",
    boundaryExample: "1、用户上传文件过程中网络中断，如何处理已上传的部分？\n2、调用第三方服务超时，是否重试？重试几次？"
  },
  {
    checkItem: "权限控制",
    scenario: "当涉及到用户权限时",
    checkPoints: "1、不同角色用户对同一功能的权限差异\n2、用户权限变更时的处理逻辑",
    example: "管理员可以查看所有用户的聊天记录，普通用户只能查看自己的",
    boundaryExample: "1、用户从管理员降级为普通用户时，如何处理其正在查看的管理员权限页面？\n2、普通用户通过URL直接访问管理员页面时，如何处理？"
  },
  {
    checkItem: "数据迁移和兼容性",
    scenario: "当功能涉及到新旧版本兼容时",
    checkPoints: "1、针对同一功能，新旧版本规则和处理逻辑有冲突的各种情况",
    example: "弹窗提示：倒计时已结束，balabala",
    boundaryExample: "1、旧版本升级到新版本后哄睡模式参数缺失时的处理？\n2、新版本故事格式(多段+音频)在旧版本界面无法展示时的兼容处理？"
  }
]

// 生成唯一ID
const generateId = () => Date.now().toString() + Math.random()

// 定义Store的状态和方法
interface BoundaryRulesState {
  // 边界规则列表
  rules: BoundaryRule[]
  
  // 操作方法
  addRule: (rule: Omit<BoundaryRule, 'id'>) => void
  updateRule: (id: string, rule: Omit<BoundaryRule, 'id'>) => void
  deleteRule: (id: string) => void
  resetRules: () => void
}

// 创建Store
export const useBoundaryRulesStore = create<BoundaryRulesState>()(
  persist(
    (set) => ({
      // 初始状态
      rules: [],
      
      // 添加规则
      addRule: (rule) => {
        const newRule: BoundaryRule = {
          ...rule,
          id: generateId()
        }
        
        set(state => ({
          rules: [...state.rules, newRule]
        }))
      },
      
      // 更新规则
      updateRule: (id, rule) => {
        set(state => ({
          rules: state.rules.map(r => 
            r.id === id ? { ...rule, id } : r
          )
        }))
      },
      
      // 删除规则
      deleteRule: (id) => {
        set(state => ({
          rules: state.rules.filter(rule => rule.id !== id)
        }))
      },
      
      // 重置为默认规则
      resetRules: () => {
        const rulesWithIds = DEFAULT_RULES.map(rule => ({
          ...rule,
          id: generateId()
        }))
        
        set({ rules: rulesWithIds })
      }
    }),
    {
      name: 'boundary-rules-storage',
      storage: createJSONStorage(() => localStorage),
      // 初始化时，如果没有数据，则使用默认规则
      onRehydrateStorage: () => (state) => {
        if (!state || state.rules.length === 0) {
          const rulesWithIds = DEFAULT_RULES.map(rule => ({
            ...rule,
            id: generateId()
          }))
          state?.resetRules()
        }
      }
    }
  )
) 