'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { BoundaryRule } from '@/types/boundary'
import { BoundaryRuleDialog } from './boundary-rule-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const defaultRules = [
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
        example: "用户在语音导航流程中，可以直接说“返回上一级”或“取消”来中断当前流程",
        boundaryExample: "1、用户在等待机器人回复时，连续多次发送消息，如何处理？ 2、用户在转人工排队过程中退出，再次进入是否需要重新排队？"
    },
    {
        checkItem: "信息或数据展示",
        scenario: "当涉及到具体的信息及数据值展示时",
        checkPoints: "1、数据取值范围、取值逻辑或计算逻辑可能涉及到的相关字段条件组合的各种Case\n2、信息或数据展示的细则要求，如数据格式要求、数据单位等",
        example: "展示用户近三个月的交易记录，并按交易时间倒序排列",
        boundaryExample: "1、用户近三个月无交易记录时，如何展示？ 2、交易记录超过一定数量（如100条）时，是否分页展示？ 3、交易金额为0或负数时，展示格式是否正确"
    },
    {
        checkItem: "交互展示影响",
        scenario: "当涉及到最大化、最小化、悬浮、半屏、弹窗展示时",
        checkPoints: "1、识别各种可能存在冲突/遮挡的Case，需要说明处理规则\n2、识别与其他交互，如拖拽、手势、回退等可能存在冲突的Case",
        example: "在手机银行APP内嵌智能客服，客服窗口以悬浮窗形式展示",
        boundaryExample: "1、悬浮窗是否会遮挡APP内的关键操作按钮？ 2、用户在全屏观看视频时，收到客服消息，悬浮窗如何展示？"
    },
    {
        checkItem: "多设备使用影响",
        scenario: "当功能涉及到多设备间的同步或交互处理时",
        checkPoints: "1、不同设备可能存在冲突的Case，需要说明处理规则",
        example: "用户能从聊天记录中查看历史图片聊天记录",
        boundaryExample: "1、多设备同时登录时是否都能看到同样的历史图片聊天记录？\n2、同一账号切换设备登陆后，是否都能看到前一设备的历史图片聊天记录？"
    },
    {
        checkItem: "多账号使用影响",
        scenario: "当功能涉及到账号处理时",
        checkPoints: "1、同一用户拥有多个不同账号下的Case",
        example: "用户能从聊天记录中查看历史图片聊天记录",
        boundaryExample: "1、多账号间的历史聊天记录应该隔离？\n2、当用同一个设备登陆不同账号时，不应该看到另一账号的聊天记录？"
    },
    {
        checkItem: "新旧版本冲突影响",
        scenario: "当功能涉及到新旧版本兼容时",
        checkPoints: "1、针对同一功能，新旧版本规则和处理逻辑有冲突的各种情况",
        example: "弹窗提示：倒计时已结束，balabala",
        boundaryExample: "1、旧版本升级到新版本后哄睡模式参数缺失时的处理？\n2、新版本故事格式(多段+音频)在旧版本界面无法展示时的兼容处理？"
    }
];

export function BoundaryRules() {
  const [rules, setRules] = useState<BoundaryRule[]>([])
  const [editingRule, setEditingRule] = useState<BoundaryRule | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const storedRules = localStorage.getItem('boundaryRules')
    if (storedRules) {
      setRules(JSON.parse(storedRules))
    } else {
      // 首次加载使用默认规则
      const rulesWithIds = defaultRules.map(rule => ({
        ...rule,
        id: Date.now().toString() + Math.random()
      }))
      setRules(rulesWithIds)
      localStorage.setItem('boundaryRules', JSON.stringify(rulesWithIds))
    }
  }, [])

  useEffect(() => {
    if (rules.length > 0) {
      localStorage.setItem('boundaryRules', JSON.stringify(rules))
    }
  }, [rules])

  const handleAdd = () => {
    setEditingRule(null)
    setShowDialog(true)
  }

  const handleEdit = (rule: BoundaryRule) => {
    setEditingRule(rule)
    setShowDialog(true)
  }

  const handleDelete = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id))
    toast({
      title: "删除成功",
      description: "边界识别规则已删除",
      duration: 3000
    })
  }

  const handleSave = (rule: Partial<BoundaryRule>) => {
    if (editingRule) {
      // 编辑现有规则
      setRules(rules.map(r => r.id === editingRule.id ? { ...rule, id: editingRule.id } as BoundaryRule : r))
      toast({
        title: "更新成功",
        description: "边界识别规则已更新",
        duration: 3000
      })
    } else {
      // 添加新规则
      const newRule = {
        ...rule,
        id: Date.now().toString() + Math.random(),
      } as BoundaryRule
      setRules([...rules, newRule])
      toast({
        title: "添加成功",
        description: "新的边界识别规则已添加",
        duration: 3000
      })
    }
    setShowDialog(false)
  }

  const handleReset = () => {
    setShowResetAlert(true)
  }

  const confirmReset = () => {
    const rulesWithIds = defaultRules.map(rule => ({
      ...rule,
      id: Date.now().toString() + Math.random()
    }))
    setRules(rulesWithIds)
    localStorage.setItem('boundaryRules', JSON.stringify(rulesWithIds))
    toast({
      title: "重置成功",
      description: "边界识别规则已恢复到初始状态",
      duration: 3000
    })
    setShowResetAlert(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">边界识别规则</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> 重置规则
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" /> 添加规则
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="py-2">检查项</TableHead>
            <TableHead className="py-2">适用场景</TableHead>
            <TableHead className="py-2">检查要点</TableHead>
            <TableHead className="py-2">示例</TableHead>
            <TableHead className="py-2">边界示例</TableHead>
            <TableHead className="py-2 w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id} className="hover:bg-gray-50">
              <TableCell className="py-2">{rule.checkItem}</TableCell>
              <TableCell className="py-2">{rule.scenario}</TableCell>
              <TableCell className="py-2 whitespace-pre-line text-sm">{rule.checkPoints}</TableCell>
              <TableCell className="py-2">{rule.example}</TableCell>
              <TableCell className="py-2 whitespace-pre-line text-sm">{rule.boundaryExample}</TableCell>
              <TableCell className="py-2">
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(rule)}
                    className="h-8 px-2"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                    className="h-8 px-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <BoundaryRuleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        rule={editingRule}
        onSave={handleSave}
        className="w-[80%] h-[80%]"
      />

      <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置规则？</AlertDialogTitle>
            <AlertDialogDescription>
              这将会清除所有修改，并将规则恢复到初始状态。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>确认重置</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 