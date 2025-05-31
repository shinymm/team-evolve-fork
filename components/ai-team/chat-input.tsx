import React from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  loading?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  loading = false,
  placeholder
}: ChatInputProps) {
  const t = useTranslations('ai-team-factory.ChatInput')
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) {
        onSend()
      }
    }
  }

  return (
    <div className="p-2 border-t mt-auto">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder || t('placeholder')}
          className="flex-1 min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <Button 
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="px-4"
        >
          {loading ? 
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> :
            <Send className="h-4 w-4" />
          }
        </Button>
      </div>
      
      {loading && (
        <div className="mt-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{t('loadingMessage')}</span>
        </div>
      )}
    </div>
  )
} 