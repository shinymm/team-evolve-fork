import React, { useRef, useEffect } from 'react'
import { MessageItem, Message } from './message-item'
import { useTranslations } from 'next-intl'

interface MessageListProps {
  messages: Message[]
  memberName?: string
  memberInitial?: string
}

export function MessageList({ messages, memberName, memberInitial }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('ai-team-factory.MessageList')

  // 在消息变化时，滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 my-4 border rounded-md">
      {messages.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          {t('noMessages')}
        </div>
      ) : (
        messages.map((message) => (
          <MessageItem 
            key={message.id} 
            message={message}
            memberName={memberName}
            memberInitial={memberInitial}
          />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
} 