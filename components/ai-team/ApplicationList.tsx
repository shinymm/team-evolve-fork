import { useEffect, useState } from 'react'
import { TeamCard } from './TeamCard'
import { ApplicationDialog } from './ApplicationDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog'
import { useTranslations } from 'next-intl'

interface Application {
  id: string
  name: string
  introduction: string
  entryUrl: string
  category?: string
}

interface ApplicationListProps {
  onStatusChange?: (loading: boolean) => void
}

export function ApplicationList({ onStatusChange }: ApplicationListProps) {
  const { toast } = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null)
  const t = useTranslations('ApplicationList')

  const fetchApplications = async () => {
    onStatusChange?.(true)
    try {
      const response = await fetch('/api/ai-team/applications')
      if (!response.ok) {
        throw new Error(t('errorMessages.fetchFailed'))
      }
      const data = await response.json()
      setApplications(data)
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast({
        title: "错误",
        description: t('errorMessages.fetchFailed'),
        variant: 'destructive',
      })
    } finally {
      onStatusChange?.(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const handleAddClick = () => {
    setEditingApplication(null)
    setDialogOpen(true)
  }

  const handleEditClick = (app: Application) => {
    console.log(t('logs.editApp'), app)
    setEditingApplication(app)
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    console.log(t('logs.prepareDelete'), id)
    setDeletingAppId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingAppId) return

    onStatusChange?.(true)
    try {
      const response = await fetch(`/api/ai-team/applications/${deletingAppId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(t('errorMessages.deleteFailed'))
      }

      toast({
        title: "成功",
        description: t('successMessages.deleteSuccess'),
      })
      
      fetchApplications()
    } catch (error) {
      console.error('删除应用失败:', error)
      toast({
        title: "错误",
        description: t('errorMessages.deleteFailed'),
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setDeletingAppId(null)
      onStatusChange?.(false)
    }
  }

  const handleDialogClose = (success: boolean) => {
    setDialogOpen(false)
    setEditingApplication(null)
    if (success) {
      fetchApplications()
    }
  }

  // 获取要删除的应用名称
  const deletingAppName = applications.find(app => app.id === deletingAppId)?.name || '此应用'

  return (
    <div>
      <div className="flex justify-end items-center mb-2">
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addButton')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {applications.map((app) => (
          <TeamCard
            key={app.id}
            id={app.id}
            name={app.name}
            introduction={app.introduction}
            entryUrl={app.entryUrl}
            category={app.category}
            type="application"
            onEdit={() => handleEditClick(app)}
            onDelete={() => handleDeleteClick(app.id)}
          />
        ))}
      </div>

      {/* 新增/编辑应用弹窗 */}
      {dialogOpen && (
        <ApplicationDialog
          key={editingApplication?.id || 'new'}
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) handleDialogClose(false)
          }}
          onSuccess={() => handleDialogClose(true)}
          editingApplication={editingApplication}
        />
      )}

      {/* 使用抽象的删除确认对话框 */}
      <ConfirmDeleteDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false)
            setDeletingAppId(null)
          } else {
            setDeleteDialogOpen(open)
          }
        }}
        onConfirm={handleDeleteConfirm}
        itemName={deletingAppName}
      />
    </div>
  )
} 