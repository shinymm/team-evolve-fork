'use client'

import { useState, useEffect, useRef } from 'react'
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
  const [isHoveringCard, setIsHoveringCard] = useState(false)

  useEffect(() => {
    const loadTasks = async () => {
      const tasks = await getTasks()
      setTasks(tasks)
    }
    loadTasks()
  }, [])

  const calculateHexagonPositions = (tasksLength: number, size: number): HexPosition[] => {
    const positions: HexPosition[] = []
    
    // 六边形的宽度和高度
    // 对于扁平边的六边形：
    // 宽度是从边到边的距离 = 2 * size * cos(30°)
    // 高度是从顶点到顶点的距离 = 2 * size
    const hexWidth = size * Math.sqrt(3)  // 2 * size * cos(30°)
    const hexHeight = size * 2
    
    // 水平间距是宽度
    const horizontalSpacing = hexWidth
    // 垂直间距是高度的 3/4，这样可以让六边形紧密相连
    const verticalSpacing = hexHeight * 3/4
    
    const rows = 6  // 减少行数以适应更大的六边形
    const cols = 13  // 减少列数以适应更大的六边形
    
    // 计算整个网格的总宽度和总高度
    const totalWidth = cols * horizontalSpacing + (hexWidth / 2)  // 加上最后一行的偏移
    const totalHeight = rows * verticalSpacing + (hexHeight / 4)  // 加上最后一个六边形的突出部分
    
    // 计算左边距，使网格居中
    const leftMargin = (1600 - totalWidth) / 2  // 1600 是 viewBox 的宽度
    const topMargin = 80
    
    for (let row = 0; row < rows; row++) {
      // 奇数行偏移半个宽度，这样可以形成蜂巢状
      const rowOffset = (row % 2) * (hexWidth / 2)
      
      for (let col = 0; col < cols; col++) {
        const x = leftMargin + col * horizontalSpacing + rowOffset
        const y = topMargin + row * verticalSpacing
        
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

      <div className="relative bg-white rounded-lg shadow-sm border p-4 min-h-[600px] overflow-hidden">
        <div className="relative" style={{ zIndex: 1 }}>
          <svg 
            width="100%" 
            height="600"
            className="overflow-visible"
            viewBox="0 0 1600 600"
            preserveAspectRatio="xMidYMid"
          >
            {calculateHexagonPositions(tasks.length, 60).map((position, index) => {
              const task = tasks[index]
              const nextTask = task?.parentTaskId ? tasks.find(t => t.id === task.parentTaskId) : undefined
              const isConnected = task?.parentTaskId !== undefined
              
              return (
                <Hexagon
                  key={index}
                  task={task}
                  x={position.x}
                  y={position.y}
                  size={60}
                  isEmpty={position.isEmpty}
                  isConnected={isConnected}
                  nextTask={nextTask}
                  onMouseEnter={() => {
                    if (!position.isEmpty) {
                      setHoveredTask(task)
                      setMousePosition({ x: position.x, y: position.y })
                    }
                  }}
                  onMouseLeave={() => {
                    if (!isHoveringCard) {
                      setHoveredTask(null)
                    }
                  }}
                />
              )
            })}
          </svg>
        </div>

        <div className="absolute inset-0" style={{ zIndex: 2, pointerEvents: 'none' }}>
          {hoveredTask && (
            <div 
              style={{
                position: 'absolute',
                left: `${mousePosition.x + (60 * 0.5)}px`,
                top: `${mousePosition.y}px`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => setIsHoveringCard(true)}
              onMouseLeave={() => {
                setIsHoveringCard(false)
                setHoveredTask(null)
              }}
            >
              <div 
                style={{
                  position: 'absolute',
                  left: '-40px',
                  top: '0',
                  width: '40px',
                  height: '100%',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={() => setIsHoveringCard(true)}
              />
              <TaskCard
                task={hoveredTask}
                position={{ x: 0, y: 0 }}
                onClose={() => {
                  setIsHoveringCard(false)
                  setHoveredTask(null)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return renderContent()
} 