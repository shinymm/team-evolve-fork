'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { BoundaryRule } from '@/types/boundary'
import { BoundaryRuleDialog } from './boundary-rule-dialog'
import { useBoundaryRulesStore } from '@/lib/stores/boundary-rules-store'
import { useTranslations } from 'next-intl'
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

export default function BoundaryRules() {
  const { rules, addRule, updateRule, deleteRule, resetRules } = useBoundaryRulesStore()
  const [editingRule, setEditingRule] = useState<BoundaryRule | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showResetAlert, setShowResetAlert] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('BoundaryRules')

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
      title: t('deleteSuccess'),
      description: t('deleteSuccessDesc'),
      duration: 3000
    })
  }

  const handleSave = (rule: Partial<BoundaryRule>) => {
    if (editingRule) {
      // 编辑现有规则
      updateRule(editingRule.id, rule as Omit<BoundaryRule, 'id'>)
      toast({
        title: t('updateSuccess'),
        description: t('updateSuccessDesc'),
        duration: 3000
      })
    } else {
      // 添加新规则
      addRule(rule as Omit<BoundaryRule, 'id'>)
      toast({
        title: t('addSuccess'),
        description: t('addSuccessDesc'),
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
      title: t('resetSuccess'),
      description: t('resetSuccessDesc'),
      duration: 3000
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <div className="space-x-2">
          <Button variant="outline" onClick={handleReset} size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            {t('reset')}
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t('addRule')}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">{t('checkItem')}</TableHead>
            <TableHead className="w-[200px]">{t('scenario')}</TableHead>
            <TableHead className="w-[300px]">{t('checkPoints')}</TableHead>
            <TableHead className="w-[200px]">{t('example')}</TableHead>
            <TableHead className="w-[300px]">{t('boundaryExample')}</TableHead>
            <TableHead className="w-[100px]">{t('actions')}</TableHead>
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
            <AlertDialogTitle>{t('resetConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('resetConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>{t('confirmReset')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 