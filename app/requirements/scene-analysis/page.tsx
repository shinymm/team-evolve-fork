'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react"
import { RequirementParserService } from '@/lib/services/requirement-parser-service'
import { useToast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface Scene {
  name: string
  overview: string
  userJourney: string[]
}

interface RequirementContent {
  reqBackground: string
  reqBrief: string
  scenes: Scene[]
}

export default function SceneAnalysisPage() {
  const [content, setContent] = useState<RequirementContent | null>(null)
  const [mdContent, setMdContent] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // 加载结构化内容
    const storedContent = localStorage.getItem('requirement-structured-content')
    if (storedContent) {
      try {
        setContent(JSON.parse(storedContent))
      } catch (e) {
        console.error('Failed to parse stored content:', e)
      }
    }

    // 加载MD内容
    const storedMd = localStorage.getItem('requirement-book-content')
    if (storedMd) {
      setMdContent(storedMd)
    }
  }, [])

  const handleParse = () => {
    if (!mdContent.trim()) {
      toast({
        title: "解析失败",
        description: "请先确保有需求书内容",
        variant: "destructive",
      })
      return
    }

    try {
      const parser = new RequirementParserService()
      const parsedContent = parser.parseRequirement(mdContent)
      setContent(parsedContent)
      localStorage.setItem('requirement-structured-content', JSON.stringify(parsedContent))
      
      toast({
        title: "解析成功",
        description: "需求书内容已重新解析",
      })
    } catch (error) {
      console.error('解析失败:', error)
      toast({
        title: "解析失败",
        description: error instanceof Error ? error.message : "解析过程中出现错误",
        variant: "destructive",
      })
    }
  }

  const handleAnalyzeScene = (scene: Scene) => {
    toast({
      title: "即将开始分析",
      description: `准备对场景"${scene.name}"进行边界分析`,
    })
    // TODO: 实现场景边界分析功能
  }

  if (!content) {
    return (
      <div className="container mx-auto py-6 w-[90%]">
        <div className="text-center text-gray-500">
          请先完成需求分析，生成结构化内容
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 w-[90%] space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">场景边界分析</h1>
        <p className="text-sm text-muted-foreground mt-1">
          基于需求书中的场景描述，分析每个场景的边界条件和异常情况
        </p>
      </div>

      {/* MD内容展示区域 */}
      <div>
        <Card className="bg-gray-50/50">
          <CardHeader className="cursor-pointer py-3" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-gray-500">需求书初稿</CardTitle>
                <span className="text-xs text-gray-400">(点击展开进行调试)</span>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
            </div>
          </CardHeader>
          {isExpanded && (
            <CardContent className="py-0 pb-3">
              <div className="space-y-3">
                <pre className="whitespace-pre-wrap text-sm text-gray-600 bg-white p-3 rounded-md border max-h-[200px] overflow-y-auto">
                  {mdContent}
                </pre>
                <Button 
                  onClick={handleParse}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="sm"
                >
                  重新解析需求书
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* 分割线和标题 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-4 text-sm font-medium text-gray-500">结构化内容</span>
        </div>
      </div>

      {/* 需求背景和概述 - 紧凑展示 */}
      <div className="space-y-2">
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium text-gray-500">需求背景</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-2">
            <p className="text-sm text-gray-600">{content.reqBackground}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-50/50">
          <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium text-gray-500">需求概述</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-2">
            <p className="text-sm text-gray-600">{content.reqBrief}</p>
          </CardContent>
        </Card>
      </div>

      {/* 场景列表 */}
      <div>
        <h2 className="text-lg font-semibold mb-3">场景列表 ({content.scenes.length})</h2>
        {content.scenes.length === 0 ? (
          <div className="text-center text-gray-500">
            未检测到场景信息，请检查需求书格式是否正确
          </div>
        ) : (
          <div className="space-y-3">
            {content.scenes.map((scene, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{scene.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">场景概述</CardDescription>
                    </div>
                    <Button 
                      onClick={() => handleAnalyzeScene(scene)}
                      className="bg-orange-500 hover:bg-orange-600"
                      size="sm"
                    >
                      <ArrowRight className="mr-2 h-3.5 w-3.5" />
                      场景边界分析
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3 space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">{scene.overview}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1.5">用户旅程 ({scene.userJourney.length} 步)</h4>
                    <div className="space-y-1">
                      {scene.userJourney.map((step, stepIndex) => (
                        <p key={stepIndex} className="text-sm text-gray-600">
                          {stepIndex + 1}. {step}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Toaster />
    </div>
  )
} 