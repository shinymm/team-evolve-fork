'use client'

import { useState, useEffect } from 'react'
import { getTasks, deleteTask, updateTask } from '@/lib/services/task-service'
import { Hexagon } from '@/components/hexagon'
import { TaskCard } from '@/components/task-card'
import { toast } from '@/components/ui/use-toast'
import type { Task } from '@/lib/services/task-service'
import { useRequirementAnalysisStore } from '@/lib/stores/requirement-analysis-store'

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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    const loadTasks = async () => {
      const tasks = await getTasks()
      setTasks(tasks)
    }
    loadTasks()
  }, [])

  const handleClearTasks = async () => {
    try {
      // 清空localStorage中的任务
      localStorage.removeItem('qare-tasks');
      
      // 清空指定的缓存数据
      // 清空store中的数据，而不是localStorage
      useRequirementAnalysisStore.getState().clearPinnedAnalysis();
      useRequirementAnalysisStore.getState().clearRequirementBook();
      localStorage.removeItem('requirement-input');
      localStorage.removeItem('requirement-structured-content');
      
      // 清空所有系统的场景分析状态
      // 1. 获取现有的localStorage键
      const localStorageKeys = Object.keys(localStorage);
      // 2. 筛选出所有scene-analysis-states相关的键
      const sceneAnalysisKeys = localStorageKeys.filter(key => key.startsWith('scene-analysis-states'));
      // 3. 逐个删除
      console.log('清空所有系统的场景分析状态...');
      sceneAnalysisKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`已清空: ${key}`);
      });
      
      // 兼容旧版本，也清除不带系统ID的键
      localStorage.removeItem('scene-analysis-states');
    
      // 强制重新加载任务服务中的任务列表
      await import('@/lib/services/task-service').then(module => {
        module.loadTasks();
        return module.getTasks();
      }).then(updatedTasks => {
        setTasks(updatedTasks);
      });
      
      setShowConfirmDialog(false);
      
      // 显示成功提示
      toast({
        title: "清空成功",
        description: "已重置为初始状态",
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to clear tasks:', error);
      // 显示错误提示
      toast({
        title: "清空失败",
        description: "操作未能完成，请重试",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const calculateHexagonPositions = (tasksLength: number, size: number): HexPosition[] => {
    const positions: HexPosition[] = []
    
    // 六边形的宽度和高度
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

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">战术板</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了所有待处理的协作任务。
        </p>
      </div>

      <div className="relative bg-white rounded-lg shadow-sm border p-4 min-h-[600px] overflow-hidden">
        <button
          onClick={() => setShowConfirmDialog(true)}
          className="absolute top-4 right-4 z-10 px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
        >
          清空任务
        </button>

        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">确认清空任务</h3>
              <p className="text-gray-600 mb-6">
                此操作将清空所有任务并重置为初始状态，是否继续？
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleClearTasks}
                  className="px-4 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                >
                  确认清空
                </button>
              </div>
            </div>
          </div>
        )}
        
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
} 