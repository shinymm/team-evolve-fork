'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Pencil, Trash2 } from 'lucide-react'

interface AITeamMember {
  id: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string
  category?: string
}

interface MemberFormData {
  id?: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string
  category?: string
}

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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[80%] max-h-[80vh] w-full">
          <DialogHeader className="pb-2">
            <DialogTitle>{editingMember?.id ? '编辑' : '添加'}AI团队成员</DialogTitle>
            <DialogDescription>
              请填写AI团队成员的信息
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-2 max-h-[calc(80vh-8rem)]">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">成员名称</Label>
                <Input 
                  id="name" 
                  name="name" 
                  defaultValue={editingMember?.name} 
                  required 
                  maxLength={50}
                  placeholder="请输入成员名称（最多50个字符）"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="introduction">个人简介</Label>
                <div className="relative">
                  <Textarea 
                    id="introduction" 
                    name="introduction" 
                    defaultValue={editingMember?.introduction}
                    required 
                    maxLength={200}
                    placeholder="请输入个人简介（最多200个字符）"
                    className="min-h-[80px] resize-none"
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                    最多200字
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">角色定位</Label>
                <Textarea 
                  id="role" 
                  name="role" 
                  defaultValue={editingMember?.role}
                  required 
                  placeholder="请详细描述该成员的角色定位"
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsibilities">任务定义与职责要求</Label>
                <Textarea 
                  id="responsibilities" 
                  name="responsibilities" 
                  defaultValue={editingMember?.responsibilities}
                  required 
                  placeholder="请详细描述该成员的具体职责和要求"
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="greeting">欢迎语</Label>
                <div className="relative">
                  <Textarea 
                    id="greeting" 
                    name="greeting" 
                    defaultValue={editingMember?.greeting}
                    maxLength={200}
                    placeholder="请输入成员的欢迎语（最多200个字符）"
                    className="min-h-[60px] resize-none"
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                    最多200字
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">类别标签</Label>
                <Input 
                  id="category" 
                  name="category" 
                  defaultValue={editingMember?.category}
                  placeholder="请输入标签，用中文或英文逗号分隔（如：需求分析,测试用例,项目管理）"
                />
                <p className="text-xs text-gray-500">
                  多个标签请用逗号分隔，支持中英文逗号
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  取消
                </Button>
                <Button type="submit">
                  {editingMember?.id ? '更新' : '保存'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader className="px-4 py-3 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
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