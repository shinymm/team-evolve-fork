import { Card, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, ExternalLink, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface TeamCardProps {
  id: string
  name: string
  introduction: string
  category?: string
  type: 'member' | 'application'
  entryUrl?: string
  onEdit: () => void
  onDelete: () => void
  onChat?: () => void
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
  onChat,
}: TeamCardProps) {
  const t = useTranslations('TeamCard')

  const handleVisit = () => {
    if (entryUrl) {
      window.open(entryUrl, '_blank')
    }
  }

  return (
    <Card>
      <CardHeader className="px-4 py-3 pb-4">
        <div className="flex flex-col h-full min-h-[120px]">
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
                  title={t('tooltips.visitApp')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {type === 'member' && onChat && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={onChat}
                  title={t('tooltips.chatWithMember')}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={onEdit}
                title={type === 'member' ? t('tooltips.editMember') : t('tooltips.editApp')}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={onDelete}
                title={type === 'member' ? t('tooltips.deleteMember') : t('tooltips.deleteApp')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 mt-2">
            <p className="text-xs text-gray-600 line-clamp-3">{introduction}</p>
          </div>
          {category && (
            <div className="flex flex-wrap gap-1.5 mt-2">
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