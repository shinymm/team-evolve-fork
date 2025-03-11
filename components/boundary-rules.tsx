'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { BoundaryRule } from '@/types/boundary'
import { BoundaryRuleDialog } from './boundary-rule-dialog'
import { useBoundaryRulesStore } from '@/lib/stores/boundary-rules-store'
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

export function BoundaryRules() {
  const { rules, addRule, updateRule, deleteRule, resetRules } = useBoundaryRulesStore()
  const [editingRule, setEditingRule] = useState<BoundaryRule | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)
  const { toast } = useToast()

  const handleAdd = () => {
    setEditingRule(null)
    setShowDialog(true)
  }

  const handleEdit = (rule: BoundaryRule) => {
    setEditingRule(rule)
    setShowDialog(true)
  }

  const handleDelete = (id: string) => {
    deleteRule(id)
    toast({
      title: "删除成功",
      description: "边界识别规则已删除",
      duration: 3000
    })
  }

  const handleSave = (rule: Partial<BoundaryRule>) => {
    if (editingRule) {
      // 编辑现有规则
      updateRule(editingRule.id, rule as Omit<BoundaryRule, 'id'>)
      toast({
        title: "更新成功",
        description: "边界识别规则已更新",
        duration: 3000
      })
    } else {
      // 添加新规则
      addRule(rule as Omit<BoundaryRule, 'id'>)
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
    resetRules()
    setShowResetAlert(false)
    toast({
      title: "重置成功",
      description: "边界识别规则已重置为默认值",
      duration: 3000
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">边界识别规则</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleReset} size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            重置
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            添加规则
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">检查项</TableHead>
            <TableHead className="w-[200px]">适用场景</TableHead>
            <TableHead className="w-[300px]">检查要点</TableHead>
            <TableHead className="w-[200px]">示例</TableHead>
            <TableHead className="w-[300px]">边界示例</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium">{rule.checkItem}</TableCell>
              <TableCell>{rule.scenario}</TableCell>
              <TableCell className="whitespace-pre-line">{rule.checkPoints}</TableCell>
              <TableCell>{rule.example}</TableCell>
              <TableCell className="whitespace-pre-line">{rule.boundaryExample}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
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
      />

      <AlertDialog open={showResetAlert} onOpenChange={setShowResetAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要重置规则吗？</AlertDialogTitle>
            <AlertDialogDescription>
              这将删除所有自定义规则，并恢复默认规则。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>确定重置</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 