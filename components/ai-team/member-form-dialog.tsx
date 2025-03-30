import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState, useEffect } from 'react'

export interface MemberFormData {
  id?: string
  name: string
  introduction: string
  role: string
  responsibilities: string
  greeting?: string
  category?: string
}

interface MemberFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMember: MemberFormData | null
  onSubmit: (data: MemberFormData) => Promise<void>
  onClose: () => void
}

export function MemberFormDialog({
  open,
  onOpenChange,
  editingMember,
  onSubmit,
  onClose,
}: MemberFormDialogProps) {
  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    introduction: '',
    role: '',
    responsibilities: '',
    greeting: '',
    category: ''
  })

  useEffect(() => {
    if (editingMember) {
      setFormData({
        ...editingMember,
        greeting: editingMember.greeting || '',
        category: editingMember.category || ''
      })
    } else {
      setFormData({
        name: '',
        introduction: '',
        role: '',
        responsibilities: '',
        greeting: '',
        category: ''
      })
    }
  }, [editingMember])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    console.log('Submitting form data:', formData)
    onSubmit(formData)
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80%] max-h-[90vh] w-full">
        <DialogHeader className="pb-1">
          <DialogTitle>{editingMember?.id ? '编辑' : '添加'}AI团队成员</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto pr-2 max-h-[calc(90vh-8rem)]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">基础信息</TabsTrigger>
                <TabsTrigger value="skills">技能配置</TabsTrigger>
              </TabsList>
              <div className="min-h-[500px]">
                <TabsContent value="basic" className="space-y-3 mt-4">
                  <div className="space-y-1">
                    <Label htmlFor="name">成员名称</Label>
                    <Input 
                      id="name" 
                      name="name" 
                      value={formData.name}
                      onChange={handleInputChange}
                      required 
                      maxLength={50}
                      placeholder="请输入成员名称（最多50个字符）"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="introduction">个人简介</Label>
                    <div className="relative">
                      <Textarea 
                        id="introduction" 
                        name="introduction" 
                        value={formData.introduction}
                        onChange={handleInputChange}
                        required 
                        maxLength={200}
                        placeholder="请输入个人简介（最多200个字符）"
                        className="min-h-[60px] resize-none text-sm"
                        rows={2}
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
                      value={formData.category}
                      onChange={handleInputChange}
                      placeholder="请输入标签，用中文或英文逗号分隔（如：需求分析,测试用例,项目管理）"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="greeting">欢迎语</Label>
                    <div className="relative">
                      <Textarea 
                        id="greeting" 
                        name="greeting" 
                        value={formData.greeting}
                        onChange={handleInputChange}
                        maxLength={200}
                        placeholder="请输入成员的欢迎语（最多200个字符）"
                        className="min-h-[120px] resize-none text-sm"
                        rows={3}
                      />
                      <span className="absolute bottom-2 right-2 text-xs text-gray-400">
                        最多200字
                      </span>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="skills" className="space-y-3 mt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="role">角色定位</Label>
                    <Textarea 
                      id="role" 
                      name="role" 
                      value={formData.role}
                      onChange={handleInputChange}
                      required 
                      placeholder="请详细描述该成员的角色定位"
                      className="min-h-[60px] resize-none text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="responsibilities">任务定义与职责要求</Label>
                    <Textarea 
                      id="responsibilities" 
                      name="responsibilities" 
                      value={formData.responsibilities}
                      onChange={handleInputChange}
                      required 
                      placeholder="请详细描述该成员的具体职责和要求"
                      className="min-h-[300px] resize-none text-sm"
                      rows={10}
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white">
              <Button type="button" variant="outline" onClick={onClose}>
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
  )
} 