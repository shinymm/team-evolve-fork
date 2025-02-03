import { getTasks, deleteTask } from '@/lib/services/task-service';

interface HexagonCellProps {
  x: number;
  y: number;
  content: string;
  isSelected: boolean;
  onClick: () => void;
}

const hexagonPoints = '-50,0 -25,-43.3 25,-43.3 50,0 25,43.3 -25,43.3';

const HexagonCell: React.FC<HexagonCellProps> = ({ x, y, content, isSelected, onClick }) => {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <polygon
        points={hexagonPoints}
        fill={isSelected ? '#e3f2fd' : 'white'}
        stroke="#2196f3"
        strokeWidth="2"
      />
      <foreignObject
        x="-40"  // 调整文本区域的位置和大小
        y="-30"
        width="80"
        height="60"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontSize: '12px',
            lineHeight: '1.2',
            overflow: 'hidden',
            wordBreak: 'break-word',
            padding: '4px'
          }}
        >
          {content.length > 7 ? `${content.slice(0, 7)}...` : content}
        </div>
      </foreignObject>
    </g>
  )
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: string;
  assignee?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  parentTaskId?: string;
  metadata?: {
    systemId?: string;
    systemName?: string;
    apiEndpoint?: string;
  };
  createdAt: string;
  position?: { x: number; y: number };
}

interface TacticsBoardProps {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const TacticsBoard: React.FC<TacticsBoardProps> = ({ tasks, onTasksChange }) => {
  const handleClearTasks = async () => {
    try {
      const tasksToDelete = tasks.slice(2);
      for (const task of tasksToDelete) {
        await deleteTask(task.id);
      }
      const updatedTasks = await getTasks();
      onTasksChange(updatedTasks);
    } catch (error) {
      console.error('Failed to clear tasks:', error);
    }
  };

  return (
    <div className="relative w-full h-[600px]">
      <button
        onClick={handleClearTasks}
        className="absolute top-4 right-4 z-10 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
      >
        清空任务
      </button>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {tasks.map((task, index) => (
          <HexagonCell
            key={task.id}
            x={task.position?.x ?? 100 + (index * 120)}
            y={task.position?.y ?? 300}
            content={task.title}
            isSelected={false}
            onClick={() => {/* 处理点击事件 */}}
          />
        ))}
      </svg>
    </div>
  );
};

export default TacticsBoard; 