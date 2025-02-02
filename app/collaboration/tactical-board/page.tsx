'use client'

import { useState, useEffect } from 'react'
import { getTasks } from '@/lib/services/task-service'
import { Hexagon } from '@/components/hexagon'
import { TaskCard } from '@/components/task-card'
import type { Task } from '@/lib/services/task-service'

interface HexPosition {
  x: number
  y: number
  isEmpty?: boolean
}

export default function TacticalBoardPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const loadTasks = async () => {
      const tasks = await getTasks()
      setTasks(tasks)
    }
    loadTasks()
  }, [])

  const calculateHexagonPositions = (tasksLength: number, size: number): HexPosition[] => {
    const positions: HexPosition[] = []
    const width = size * Math.cos(30 * Math.PI / 180) * 2
    const height = size * Math.sin(60 * Math.PI / 180) * 2
    
    const rows = 8
    const cols = 22
    const totalWidth = cols * width
    const leftMargin = 40
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = leftMargin + col * width + (row % 2 ? width / 2 : 0)
        const y = 60 + row * (height * 0.75)
        
        const index = row * cols + col
        const isEmpty = index >= tasksLength
        
        positions.push({ x, y, isEmpty })
      }
    }
    
    return positions
  }

  const renderContent = () => (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">蜂群战术板</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了所有待处理的协作任务。
        </p>
      </div>

      <div className="relative bg-white rounded-lg shadow-sm border p-4 min-h-[500px]">
        <svg 
          width="100%" 
          height="500"
          className="overflow-visible"
          viewBox="0 0 1600 500"
          preserveAspectRatio="xMidYMid meet"
        >
          {calculateHexagonPositions(tasks.length, 40).map((position, index) => {
            const task = tasks[index]
            const nextTask = task?.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : undefined
            const isConnected = task?.parentTaskId !== undefined
            
            return (
              <Hexagon
                key={index}
                task={task}
                x={position.x}
                y={position.y}
                size={40}
                isEmpty={position.isEmpty}
                isConnected={isConnected}
                nextTask={nextTask}
                onMouseEnter={() => {
                  if (!position.isEmpty) {
                    setHoveredTask(task)
                    setMousePosition({ x: position.x, y: position.y })
                  }
                }}
              />
            )
          })}
        </svg>

        {hoveredTask && (
          <div 
            className="absolute top-0 left-0"
            onMouseLeave={() => setHoveredTask(null)}
          >
            <TaskCard
              task={hoveredTask}
              position={{
                x: mousePosition.x + 60,
                y: mousePosition.y - 20
              }}
              onClose={() => setHoveredTask(null)}
            />
          </div>
        )}
      </div>
    </div>
  )

  return renderContent()
} 