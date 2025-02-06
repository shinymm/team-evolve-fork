'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { StructuredRequirement } from '@/lib/services/requirement-export-service'

export default function BookConfirmPage() {
  const [requirement, setRequirement] = useState<StructuredRequirement | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // 从localStorage加载结构化需求数据
    const storedReq = localStorage.getItem('structuredRequirement')
    if (storedReq) {
      try {
        setRequirement(JSON.parse(storedReq))
      } catch (e) {
        console.error('Failed to parse stored requirement:', e)
        toast({
          title: "加载失败",
          description: "无法加载需求数据",
          variant: "destructive",
          duration: 3000
        })
      }
    }
  }, [])

  const handleExport = () => {
    if (!requirement) return

    // 生成Markdown格式的需求书
    const mdContent = generateMarkdown(requirement)
    
    // 创建Blob对象
    const blob = new Blob([mdContent], { type: 'text/markdown' })
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '需求书.md'
    
    // 触发下载
    document.body.appendChild(a)
    a.click()
    
    // 清理
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "导出成功",
      description: "需求书已导出",
      duration: 3000
    })
  }

  // 生成Markdown格式的需求书
  const generateMarkdown = (req: StructuredRequirement): string => {
    let md = '# 需求书\n\n'
    
    md += '## 需求背景\n\n'
    md += req.reqBackground + '\n\n'
    
    md += '## 需求概述\n\n'
    md += req.reqBrief + '\n\n'
    
    md += '## 需求详情\n\n'
    
    req.sceneList.forEach((scene, index) => {
      md += `### ${index + 1}. ${scene.sceneName}\n\n`
      
      md += '#### 场景概述\n\n'
      md += scene.sceneOverview + '\n\n'
      
      md += '#### 用户旅程\n\n'
      scene.sceneUserJourney.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`
      })
      md += '\n'
      
      md += '#### 前置条件\n\n'
      md += scene.preconditions + '\n\n'
      
      md += '#### 约束条件\n\n'
      md += scene.constraints + '\n\n'
      
      md += '#### 异常处理\n\n'
      md += scene.exceptions + '\n\n'
      
      md += '#### 补充说明\n\n'
      md += scene.notes + '\n\n'
      
      md += '---\n\n'
    })
    
    return md
  }

  if (!requirement) {
    return (
      <div className="mx-auto py-6 w-[90%] space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">需求书确认</h1>
          <p className="text-sm text-muted-foreground mt-1">
            确认生成的需求书内容，并导出最终版本
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>加载需求数据中...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto py-6 w-[90%] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">需求书确认</h1>
          <p className="text-sm text-muted-foreground mt-1">
            确认生成的需求书内容，并导出最终版本
          </p>
        </div>
        <Button onClick={handleExport} className="bg-orange-500 hover:bg-orange-600">
          导出需求书
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <h3 className="text-lg font-semibold mb-2">需求背景</h3>
            <p className="whitespace-pre-wrap">{requirement.reqBackground}</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-2">需求概述</h3>
            <p className="whitespace-pre-wrap">{requirement.reqBrief}</p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">场景列表</h3>
            <div className="space-y-6">
              {requirement.sceneList.map((scene, index) => (
                <Card key={index} className="border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {index + 1}. {scene.sceneName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-1">场景概述</h4>
                      <p className="text-sm whitespace-pre-wrap">{scene.sceneOverview}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">用户旅程</h4>
                      <ul className="list-decimal list-inside text-sm">
                        {scene.sceneUserJourney.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">前置条件</h4>
                      <p className="text-sm whitespace-pre-wrap">{scene.preconditions}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">约束条件</h4>
                      <p className="text-sm whitespace-pre-wrap">{scene.constraints}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">异常处理</h4>
                      <p className="text-sm whitespace-pre-wrap">{scene.exceptions}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-1">补充说明</h4>
                      <p className="text-sm whitespace-pre-wrap">{scene.notes}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Toaster />
    </div>
  )
} 