import { useEffect, useState } from 'react'
import { TeamCard } from './TeamCard'
import { ApplicationDialog } from './ApplicationDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
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

interface Application {
  id: string
  name: string
  introduction: string
  entryUrl: string
  category?: string
}

export function ApplicationList() {
  const { toast } = useToast()
  const [applications, setApplications] = useState<Application[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null)

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/ai-team/applications')
      if (!response.ok) {
        throw new Error('Failed to fetch applications')
      }
      const data = await response.json()
      setApplications(data)
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast({
        title: '错误',
        description: '获取应用列表失败',
        variant: 'destructive',
      })
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
    console.log('编辑应用:', app)
    setEditingApplication(app)
    setDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    console.log('准备删除应用ID:', id)
    setDeletingAppId(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingAppId) return

    try {
      const response = await fetch(`/api/ai-team/applications/${deletingAppId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete application')
      }

      toast({
        title: '成功',
        description: '应用已成功删除',
      })
      
      fetchApplications()
    } catch (error) {
      console.error('删除应用失败:', error)
      toast({
        title: '错误',
        description: '删除应用失败，请重试',
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setDeletingAppId(null)
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">集成应用</h2>
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          引入应用
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

      {/* 删除确认弹窗 */}
      <AlertDialog 
        open={deleteDialogOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false)
            setDeletingAppId(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除应用"{deletingAppName}"吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 