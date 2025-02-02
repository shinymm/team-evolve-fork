'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export default function RequirementEvolution() {
  const [requirement, setRequirement] = useState('')
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!requirement.trim()) {
      toast({
        title: "请输入需求",
        description: "需求内容不能为空",
        variant: "destructive",
      })
      return
    }

    // TODO: 这里将添加与AI交互的逻辑
    toast({
      title: "需求已提交",
      description: "正在分析您的需求...",
    })
  }

  return (
    <div className="container mx-auto py-6 w-[90%]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">需求衍化</h1>
          <p className="text-muted-foreground mt-2">
            请输入您的初步需求想法，我们将帮助您逐步细化和完善它。
          </p>
        </div>
        
        <div className="space-y-4">
          <Textarea
            placeholder="请描述您的需求想法..."
            className="min-h-[200px]"
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
          />
          <Button onClick={handleSubmit} className="w-full bg-orange-500 hover:bg-orange-600">
            开始分析
          </Button>
        </div>
      </div>
    </div>
  )
} 