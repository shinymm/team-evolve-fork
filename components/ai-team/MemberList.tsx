import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { MemberFormDialog, MemberFormData } from './member-form-dialog'
import { TeamCard } from './TeamCard'
import { ChatDialog } from './ChatDialog'

type AITeamMember = MemberFormData & { id: string; mcpConfigJson?: string | null }

interface MemberListProps {
  onStatusChange?: (loading: boolean) => void
}

export function MemberList({ onStatusChange }: MemberListProps) {
  const [members, setMembers] = useState<AITeamMember[]>([])
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null)
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false)
  const [chatMember, setChatMember] = useState<AITeamMember | null>(null)
  const { toast } = useToast()

  // 加载团队成员列表
  const loadMembers = async () => {
    onStatusChange?.(true)
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
    } finally {
      onStatusChange?.(false)
    }
  }

  useEffect(() => {
    loadMembers()
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
    
    onStatusChange?.(true)
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
    } finally {
      onStatusChange?.(false)
    }
  }

  // 删除成员
  const handleDeleteMember = async (id: string) => {
    onStatusChange?.(true)
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
    } finally {
      onStatusChange?.(false)
    }
  }

  // 打开聊天对话框
  const handleOpenChat = (member: AITeamMember) => {
    setChatMember(member)
    setIsChatDialogOpen(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">团队成员</h2>
        <Button onClick={() => handleOpenMemberDialog()}>添加成员</Button>
      </div>

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
            onChat={() => handleOpenChat(member)}
          />
        ))}
      </div>

      <MemberFormDialog
        open={isMemberDialogOpen}
        onOpenChange={setIsMemberDialogOpen}
        editingMember={editingMember}
        onSubmit={handleSubmitMember}
        onClose={handleCloseMemberDialog}
      />

      <ChatDialog
        open={isChatDialogOpen}
        onOpenChange={setIsChatDialogOpen}
        member={chatMember}
      />
    </div>
  )
} 