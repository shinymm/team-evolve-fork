'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { MemberFormDialog, MemberFormData } from '@/components/ai-team/member-form-dialog'
import { ApplicationDialog } from '@/components/ai-team/ApplicationDialog'
import { TeamCard } from '@/components/ai-team/TeamCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'
import { Card, CardHeader } from '@/components/ui/card'
import { ExternalLink, Pencil, Trash2 } from 'lucide-react'

type AITeamMember = MemberFormData & { id: string; mcpConfigJson?: string | null }

interface Application {
  id: string
  name: string
  introduction: string
  entryUrl: string
  category?: string
}

export default function AITeamPage() {
  const [activeTab, setActiveTab] = useState('members')
  const [members, setMembers] = useState<AITeamMember[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null)
  const [editingApplication, setEditingApplication] = useState<Application | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null)
  const { toast } = useToast()

  // 加载团队成员列表
  const loadMembers = async () => {
    try {
      const response = await fetch('/api/settings/ai-team')
      if (!response.ok) throw new Error('加载失败')
      const data = await response.json()
      setMembers(data)
    } catch (error) {
      toast({
        title: '错误',
        description: '加载AI团队成员失败',
        variant: 'destructive',
      })
    }
  }

  // 加载应用列表
  const loadApplications = async () => {
    try {
      const response = await fetch('/api/ai-team/applications')
      if (!response.ok) throw new Error('加载失败')
      const data = await response.json()
      setApplications(data)
    } catch (error) {
      toast({
        title: '错误',
        description: '加载应用列表失败',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    loadMembers()
    loadApplications()
  }, [])

  const handleOpenMemberDialog = (member?: AITeamMember) => {
    if (member) {
      setEditingMember(member)
    } else {
      setEditingMember({
        name: '',
        introduction: '',
        role: '',
        responsibilities: '',
        greeting: '',
        category: ''
      })
    }
    setIsMemberDialogOpen(true)
  }

  const handleCloseMemberDialog = () => {
    setIsMemberDialogOpen(false)
    setEditingMember(null)
  }

  // 提交成员表单（添加或编辑）
  const handleSubmitMember = async (data: MemberFormData & { mcpConfigJson?: string | null }) => {
    if (!data.name?.trim() || !data.introduction?.trim() || !data.role?.trim() || !data.responsibilities?.trim()) {
      toast({
        title: '错误',
        description: '请填写所有必填字段',
        variant: 'destructive',
      })
      return
    }
    
    try {
      const url = editingMember?.id 
        ? `/api/settings/ai-team?id=${editingMember.id}`
        : '/api/settings/ai-team'
      
      const response = await fetch(url, {
        method: editingMember?.id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          greeting: data.greeting?.trim() || null,
          category: data.category?.trim() || null,
          mcpConfigJson: data.mcpConfigJson || null,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || (editingMember?.id ? '更新失败' : '添加失败'))
      }

      toast({
        title: '成功',
        description: `AI团队成员${editingMember?.id ? '更新' : '添加'}成功`,
      })
      handleCloseMemberDialog()
      loadMembers()
    } catch (error) {
      console.error('Form submission error:', error)
      toast({
        title: '错误',
        description: error instanceof Error ? error.message : `${editingMember?.id ? '更新' : '添加'}AI团队成员失败`,
        variant: 'destructive',
      })
    }
  }

  // 删除成员
  const handleDeleteMember = async (id: string) => {
    try {
      const response = await fetch(`/api/settings/ai-team?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('删除失败')

      toast({
        title: '成功',
        description: 'AI团队成员删除成功',
      })
      loadMembers()
    } catch (error) {
      toast({
        title: '错误',
        description: '删除AI团队成员失败',
        variant: 'destructive',
      })
    }
  }

  const handleOpenApplicationDialog = (application?: Application) => {
    console.log('handleOpenApplicationDialog 被调用，应用:', application)
    if (application) {
      setEditingApplication(application)
    } else {
      setEditingApplication(null)
    }
    console.log('设置 isApplicationDialogOpen = true')
    setIsApplicationDialogOpen(true)
    console.log('当前 editingApplication 状态:', application)
  }

  const handleCloseApplicationDialog = () => {
    console.log('handleCloseApplicationDialog 被调用')
    setIsApplicationDialogOpen(false)
    setEditingApplication(null)
  }

  // 准备删除应用
  const handlePrepareDeleteApplication = (id: string) => {
    setDeletingAppId(id)
    setIsDeleteDialogOpen(true)
  }

  // 删除应用
  const handleDeleteApplication = async () => {
    if (!deletingAppId) return;
    
    try {
      const response = await fetch(`/api/ai-team/applications/${deletingAppId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('删除失败')

      toast({
        title: '成功',
        description: '应用删除成功',
      })
      loadApplications()
    } catch (error) {
      toast({
        title: '错误',
        description: '删除应用失败',
        variant: 'destructive',
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setDeletingAppId(null)
    }
  }

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI团队工厂</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="members">团队成员</TabsTrigger>
            <TabsTrigger value="applications">集成应用</TabsTrigger>
          </TabsList>
          {activeTab === 'members' ? (
            <Button onClick={() => handleOpenMemberDialog()}>添加成员</Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => {
                console.log('点击了引入应用按钮')
                handleOpenApplicationDialog()
              }}>引入应用</Button>
            </div>
          )}
        </div>

        <TabsContent value="members" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <TeamCard
                key={member.id}
                id={member.id}
                type="member"
                name={member.name}
                introduction={member.introduction}
                category={member.category || undefined}
                onEdit={() => handleOpenMemberDialog(member)}
                onDelete={() => handleDeleteMember(member.id)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((app) => (
              <TeamCard
                key={app.id}
                id={app.id}
                type="application"
                name={app.name}
                introduction={app.introduction}
                category={app.category}
                entryUrl={app.entryUrl}
                onEdit={() => handleOpenApplicationDialog(app)}
                onDelete={() => handlePrepareDeleteApplication(app.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <MemberFormDialog
        open={isMemberDialogOpen}
        onOpenChange={setIsMemberDialogOpen}
        editingMember={editingMember}
        onSubmit={handleSubmitMember}
        onClose={handleCloseMemberDialog}
      />

      <ApplicationDialog
        open={isApplicationDialogOpen}
        onOpenChange={(open) => {
          console.log('ApplicationDialog onOpenChange:', open)
          if (open) {
            console.log('打开对话框')
          } else {
            console.log('关闭对话框')
            handleCloseApplicationDialog()
          }
        }}
        onSuccess={() => {
          console.log('ApplicationDialog onSuccess')
          loadApplications()
        }}
        editingApplication={editingApplication}
      />

      {/* 删除确认对话框 */}
      <AlertDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          console.log('删除对话框 onOpenChange:', open)
          if (!open) {
            console.log('关闭删除对话框，重置 deletingAppId')
            setDeletingAppId(null)
          }
          setIsDeleteDialogOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除此应用吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('取消删除')
              setIsDeleteDialogOpen(false)
              setDeletingAppId(null)
            }}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteApplication} className="bg-red-600 hover:bg-red-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}