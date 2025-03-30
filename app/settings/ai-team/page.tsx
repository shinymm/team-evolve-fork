'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Pencil, Trash2 } from 'lucide-react'
import { MemberFormDialog, MemberFormData } from '@/components/ai-team/member-form-dialog'

type AITeamMember = MemberFormData & { id: string }

export default function AITeamPage() {
  const [members, setMembers] = useState<AITeamMember[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberFormData | null>(null)
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

  useEffect(() => {
    loadMembers()
  }, [])

  const handleOpenDialog = (member?: AITeamMember) => {
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
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingMember(null)
  }

  // 提交表单（添加或编辑）
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name'),
      introduction: formData.get('introduction'),
      role: formData.get('role'),
      responsibilities: formData.get('responsibilities'),
      greeting: formData.get('greeting'),
      category: formData.get('category'),
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
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error(editingMember?.id ? '更新失败' : '添加失败')

      toast({
        title: '成功',
        description: `AI团队成员${editingMember?.id ? '更新' : '添加'}成功`,
      })
      handleCloseDialog()
      loadMembers()
    } catch (error) {
      toast({
        title: '错误',
        description: `${editingMember?.id ? '更新' : '添加'}AI团队成员失败`,
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

  return (
    <div className="mx-auto py-6 w-[90%]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI团队工厂</h1>
        <Button onClick={() => handleOpenDialog()}>添加成员</Button>
      </div>

      <MemberFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingMember={editingMember}
        onSubmit={handleSubmit}
        onClose={handleCloseDialog}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader className="px-4 py-3 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm font-medium shadow-sm">
                      {member.name.charAt(0)}
                    </div>
                    <CardTitle className="text-base">{member.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleOpenDialog(member)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteMember(member.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 line-clamp-4 mb-1">{member.introduction}</p>
                {member.category && (
                  <div className="flex flex-wrap gap-1">
                    {member.category.split(/[,，]/).map((tag, index) => (
                      tag.trim() && (
                        <span 
                          key={index}
                          className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[10px] whitespace-nowrap"
                        >
                          {tag.trim()}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}