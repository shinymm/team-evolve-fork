'use client'

import { motion } from "framer-motion"
import { useState } from "react"
import { Badge } from "./ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { Sparkles } from "lucide-react"
import { useRouter } from 'next/navigation'
import { getTaskActions } from '@/lib/task-routes'
import type { Task } from '@/lib/services/task-service'

interface TaskCardProps {
  task: Task
  position: { x: number; y: number }
  onClose: () => void
}

export function TaskCard({ task, position, onClose }: TaskCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const router = useRouter()
  const taskActions = getTaskActions(task)

  const handleMouseLeave = () => {
    if (!isHovering) {
      onClose()
    }
  }

  const handleGetAIHelp = () => {
    if (taskActions?.aiHelp) {
      router.push(taskActions.aiHelp.route)
    } else {
      console.log('No AI help action defined for task:', task.id)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute bg-white p-3 rounded-lg shadow-lg border w-[280px]"
      style={{
        left: position.x + 'px',
        top: position.y + 'px',
        zIndex: 50
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false)
        handleMouseLeave()
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-gray-900 truncate">{task.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="bg-orange-50 text-orange-700 text-[10px] px-1.5 py-0">
              {task.type}
            </Badge>
            <span className="text-[10px] text-gray-500">
              {new Date(task.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src="/avatars/sara.jpg" />
          <AvatarFallback>SQ</AvatarFallback>
        </Avatar>
      </div>
      
      {task.metadata && (
        <div className="mt-2 bg-gray-50 rounded-sm p-1.5 border border-gray-100">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Link className="h-3 w-3" />
            <span>触发自：</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] px-1 py-0 font-normal">
              API订阅
            </Badge>
          </div>
          <div className="mt-1 text-[10px] text-gray-600">
            <span className="text-orange-600 font-medium">{task.metadata.systemName}</span>
            <span className="mx-1">({task.metadata.systemId})</span>
            <span>订阅了</span>
            <span className="text-blue-600 font-medium mx-1">{task.metadata.apiEndpoint}</span>
          </div>
        </div>
      )}
      
      <p className="mt-2 text-xs text-gray-500 line-clamp-2">{task.description}</p>
      
      <div className="mt-2 flex gap-1.5">
        {taskActions?.aiHelp && (
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1 h-6 px-1.5 text-[10px] bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"
            onClick={handleGetAIHelp}
            title={taskActions.aiHelp.description}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            召唤AI能力胶囊
          </Button>
        )}
      </div>
    </motion.div>
  )
} 