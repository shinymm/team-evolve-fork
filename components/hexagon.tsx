'use client'

import type { Task } from '@/lib/services/task-service'

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
    <g style={{ isolation: 'isolate' }}>
      {/* 定义滤镜 */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feFlood floodColor="#FED7AA" floodOpacity="0.5" />
          <feComposite in2="blur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#475569" floodOpacity="0.1" />
        </filter>
      </defs>

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
      
      {/* 空的六边形放在底层 */}
      {isEmpty && (
        <polygon
          points={points}
          fill="#F9FAFB"
          stroke="#E5E7EB"
          strokeWidth="1"
        />
      )}
      
      {/* 有任务的六边形放在上层 */}
      {!isEmpty && (
        <>
          {/* 发光效果 */}
          <polygon
            points={points}
            fill="none"
            stroke="#FDBA74"
            strokeWidth="1"
            filter="url(#glow)"
          />
          
          {/* 主体六边形 */}
          <polygon
            points={points}
            fill="#FFF7ED"
            stroke="#FDBA74"
            strokeWidth="1"
            className="cursor-pointer hover:fill-orange-100 transition-transform duration-200 hover:-translate-y-1"
            filter="url(#shadow)"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          />
          
          {/* 任务标题 */}
          {task && (
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[14px] fill-gray-600 pointer-events-none select-none"
            >
              {task.title}
            </text>
          )}
        </>
      )}
    </g>
  )
}

function calculateHexagonPoints(centerX: number, centerY: number, size: number): string {
  // 计算六边形的六个顶点
  // 从正上方开始，顺时针旋转
  // 注意：我们从 30 度开始，这样可以得到一个扁平边的六边形
  const points: { x: number; y: number }[] = []
  
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 6) + (i * Math.PI / 3) // 从30度开始，每次加60度
    points.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle)
    })
  }

  return points.map(p => `${p.x},${p.y}`).join(' ')
}

function calculateConnectionPoints(fromX: number, fromY: number, size: number) {
  // 计算两个六边形之间的连接点
  const rightPoint = {
    x: fromX + size * Math.cos(0), // 当前六边形的右侧中点
    y: fromY
  }
  
  const leftPoint = {
    x: fromX + size * 2 * Math.cos(0), // 下一个六边形的左侧中点
    y: fromY
  }

  return {
    start: rightPoint,
    end: leftPoint
  }
} 