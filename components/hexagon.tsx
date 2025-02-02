'use client'

import { Task } from './task-card'

interface HexagonProps {
  x: number
  y: number
  size: number
  task?: Task
  isEmpty?: boolean
  isConnected?: boolean
  nextTask?: Task
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function Hexagon({
  x,
  y,
  size,
  task,
  isEmpty = false,
  isConnected = false,
  nextTask,
  onMouseEnter,
  onMouseLeave
}: HexagonProps) {
  // 计算六边形的点
  const points = calculateHexagonPoints(x, y, size)
  
  // 如果有连接线，计算连接点
  const connectionPoints = isConnected && nextTask ? calculateConnectionPoints(x, y, size) : null

  return (
    <>
      {/* 如果有连接线，先画线 */}
      {connectionPoints && (
        <line
          x1={connectionPoints.start.x}
          y1={connectionPoints.start.y}
          x2={connectionPoints.end.x}
          y2={connectionPoints.end.y}
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      )}
      
      {/* 画六边形 */}
      <polygon
        points={points}
        fill={isEmpty ? '#F9FAFB' : '#FFF7ED'}
        stroke={isEmpty ? '#E5E7EB' : '#FDBA74'}
        strokeWidth="1"
        className={!isEmpty ? 'cursor-pointer hover:fill-orange-100' : ''}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      
      {/* 如果有任务，显示任务标题 */}
      {task && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[10px] fill-gray-600 pointer-events-none select-none"
        >
          {task.title}
        </text>
      )}
    </>
  )
}

function calculateHexagonPoints(x: number, y: number, size: number): string {
  const angle = Math.PI / 3
  const points: { x: number; y: number }[] = []
  
  for (let i = 0; i < 6; i++) {
    points.push({
      x: x + size * Math.cos(angle * i),
      y: y + size * Math.sin(angle * i)
    })
  }
  
  return points.map(p => `${p.x},${p.y}`).join(' ')
}

function calculateConnectionPoints(x: number, y: number, size: number) {
  return {
    start: { x: x + size, y },
    end: { x: x + size * 2, y }
  }
} 