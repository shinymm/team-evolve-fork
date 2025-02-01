'use client'

import { useEffect, useState } from 'react'
import { Card } from 'antd'
import dynamic from 'next/dynamic'

// 动态导入 PlantUML 组件
const PlantUML = dynamic(() => import('react-plantuml'), { ssr: false })

interface Props {
  source: string
  title: string
  description: string
}

export function ArchitectureViewer({ source, title, description }: Props) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 模拟加载
    setTimeout(() => setLoading(false), 500)
  }, [source])

  return (
    <Card title={title} className="mt-4">
      <p className="mb-4 text-gray-600">{description}</p>
      
      <div className="border rounded-lg p-4 bg-white">
        {loading ? (
          <div className="h-[400px] flex items-center justify-center">
            加载中...
          </div>
        ) : (
          <div style={{ height: '400px', width: '100%' }}>
            <PlantUML
              value={source}
              format="svg"
            />
          </div>
        )}
      </div>
    </Card>
  )
} 