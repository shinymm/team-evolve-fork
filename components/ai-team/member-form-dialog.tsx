import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

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
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
  onClose: () => void
}

export function MemberFormDialog({
  open,
  onOpenChange,
  editingMember,
  onSubmit,
  onClose,
}: MemberFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[80%] max-h-[80vh] w-full">
        <DialogHeader className="pb-2">
          <DialogTitle>{editingMember?.id ? '编辑' : '添加'}AI团队成员</DialogTitle>
          <DialogDescription>
            请填写AI团队成员的信息
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto pr-2 max-h-[calc(80vh-8rem)]">
          <form onSubmit={onSubmit} className="space-y-3">
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