'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface StructuredScene {
  sceneName: string
  sceneOverview: string
  sceneUserJourney: string[]
  preconditions: string
  constraints: string
  exceptions: string
  notes: string
}

export default function UserStoryPage() {
  const [requirementText, setRequirementText] = useState('')
  const [scenes, setScenes] = useState<StructuredScene[]>([])
  const [selectedScene, setSelectedScene] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    // 从localStorage获取结构化需求
    const storedRequirement = localStorage.getItem('structuredRequirement')
    if (storedRequirement) {
      const requirement = JSON.parse(storedRequirement)
      setScenes(requirement.sceneList || [])
    }
  }, [])

  const handleSceneSelect = (sceneIndex: string) => {
    const scene = scenes[parseInt(sceneIndex)]
    if (scene) {
      // 将场景的所有相关信息组合成文本
      const sceneContent = [
        `场景名称：${scene.sceneName}`,
        `\n场景概述：${scene.sceneOverview}`,
        `\n用户旅程：\n${scene.sceneUserJourney.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
        `\n前置条件：${scene.preconditions}`,
        `\n约束条件：${scene.constraints}`,
        `\n异常处理：${scene.exceptions}`,
        `\n补充说明：${scene.notes}`
      ].join('\n')
      
      setRequirementText(sceneContent)
      setSelectedScene(sceneIndex)
      setIsDialogOpen(false)
    }
  }

  const handleAnalyze = () => {
    // TODO: 实现用户故事拆解逻辑
    console.log('分析中...')
  }

  return (
    <div className="w-[90%] mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">用户故事拆解</h1>
        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-600 text-sm ">
            通过AI分析需求内容，将场景拆解为更细粒度的用户故事，帮助团队更好地理解和实现需求。
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-s text-gray-500 hover:text-gray-700"
              >
                从缓存中加载场景
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>选择要加载的场景</DialogTitle>
              </DialogHeader>
              <Select value={selectedScene} onValueChange={handleSceneSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="选择要拆解的场景" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene: StructuredScene, index: number) => (
                    <SelectItem key={index} value={String(index)}>
                      {`场景${index + 1}: ${scene.sceneName}` || `场景 ${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <Textarea
            placeholder="请输入需求内容..."
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            className="min-h-[200px]"
          />

          <Button 
            onClick={handleAnalyze} 
            className="w-full bg-orange-500 hover:bg-orange-600"
          >
            开始拆解用户故事
          </Button>
        </div>
      </Card>
    </div>
  )
} 