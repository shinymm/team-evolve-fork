'use client'

import { motion } from "framer-motion"
import type { Task } from '@/lib/services/task-service'

interface HexagonProps {
  task?: Task
  x: number
  y: number
  size: number
  isEmpty?: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  isConnected?: boolean
  nextTask?: Task
}

export function Hexagon({ task, x, y, size, isEmpty = false, onMouseEnter, onMouseLeave, isConnected, nextTask }: HexagonProps) {
  // 计算六边形的点
  const points = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i * 60 - 30) * Math.PI / 180
    return `${x + size * Math.cos(angle)},${y + size * Math.sin(angle)}`
  }).join(' ')

  // 根据任务分配者设置颜色
  const getHexagonColor = () => {
    if (isEmpty) return '#F3F4F6' // 空位使用浅灰色
    const colors: Record<string, string> = {
      'SaraQian': '#FDE68A', // 黄色
      'default': '#E5E7EB'   // 灰色
    }
    return colors[task?.assignee || 'default'] || colors.default
  }

  return (
    <motion.g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      initial={!isEmpty ? { y: 0, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' } : {}}
      animate={!isEmpty ? { 
        y: -2,
        filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.07))'
      } : {}}
      whileHover={!isEmpty ? { 
        y: -4,
        filter: 'drop-shadow(0 8px 5px rgba(0,0,0,0.1))',
        scale: 1.05 
      } : {}}
      transition={{ 
        type: "spring", 
        stiffness: 300,
        damping: 20
      }}
    >
      {isConnected && !isEmpty && nextTask && (
        <>
          <line
            x1={x + size * 1.2}
            y1={y}
            x2={x + size * 1.8}
            y2={y}
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <polygon
            points={`
              ${x + size * 1.8},${y}
              ${x + size * 1.7},${y - 5}
              ${x + size * 1.7},${y + 5}
            `}
            fill="#94A3B8"
          />
          <circle
            cx={x + size * 1.5}
            cy={y - 8}
            r={4}
            fill={task?.status === 'completed' ? '#22C55E' : '#FCD34D'}
          />
        </>
      )}
      <polygon
        points={points}
        fill={getHexagonColor()}
        stroke={isEmpty ? '#E5E7EB' : '#94A3B8'}
        strokeWidth={isEmpty ? 1 : 2}
        className={`transition-colors ${isEmpty ? 'opacity-50' : 'cursor-pointer hover:fill-opacity-80'}`}
      />
      {!isEmpty && task && (
        <>
          <text
            x={x}
            y={y - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs font-medium fill-gray-600 pointer-events-none"
          >
            {task.id.slice(0, 8)}
          </text>
          <text
            x={x}
            y={y + 8}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] fill-gray-500 pointer-events-none"
          >
            {task.status === 'pending' ? '待处理' : task.status === 'in_progress' ? '进行中' : '已完成'}
          </text>
        </>
      )}
    </motion.g>
  )
} 