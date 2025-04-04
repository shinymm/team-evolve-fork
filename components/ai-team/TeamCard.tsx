import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'

interface TeamCardProps {
  id: string
  name: string
  introduction: string
  category?: string
  type: 'member' | 'application'
  entryUrl?: string
  onEdit: () => void
  onDelete: () => void
}

export function TeamCard({
  id,
  name,
  introduction,
  category,
  type,
  entryUrl,
  onEdit,
  onDelete,
}: TeamCardProps) {
  const handleVisit = () => {
    if (entryUrl) {
      window.open(entryUrl, '_blank')
    }
  }

  return (
    <Card>
      <CardHeader className="px-4 py-3 pb-4">
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium shadow-sm text-white
                  ${type === 'member' ? 'bg-orange-600' : 'bg-blue-600'}`}
              >
                {name.charAt(0)}
              </div>
              <div className="font-medium leading-none mt-1">{name}</div>
            </div>
            <div className="flex items-center gap-1">
              {type === 'application' && entryUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleVisit}
                  title="访问应用"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {type === 'application' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onEdit}
                  title="编辑应用"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={onDelete}
                title="删除应用"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-600 line-clamp-4 mb-1">{introduction}</p>
          {category && (
            <div className="flex flex-wrap gap-1.5">
              {category.split(/[,，]/).map((tag, index) => (
                tag.trim() && (
                  <span 
                    key={index}
                    className="px-2.5 py-0.5 bg-gray-700 text-white rounded-full text-[10px] whitespace-nowrap font-medium"
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
  )
} 