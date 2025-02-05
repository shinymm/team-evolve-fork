'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import PlantUML from 'react-plantuml'



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
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
} 