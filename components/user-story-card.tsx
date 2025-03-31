import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Copy } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export interface UserStory {
  story: string;
  description: string;
  acceptance_criteria: string[];
  non_functional_requirements?: string[];
}

export interface UserStoryCardProps {
  story: UserStory;
  featureName: string;
  index: number;
  onEdit?: (story: UserStory, featureIndex: number, storyIndex: number) => void;
  onDelete?: (featureIndex: number, storyIndex: number) => void;
  featureIndex: number;
}

export function UserStoryCard({ 
  story, 
  featureName, 
  index, 
  onEdit, 
  onDelete, 
  featureIndex 
}: UserStoryCardProps) {
  console.log(`渲染卡片 #${index + 1}:`, { story, featureName });
  
  const handleCopy = () => {
    // 格式化用户故事内容
    const storyContent = [
      `用户故事: ${story.story}`,
      `描述: ${story.description}`,
      `验收标准:`,
      ...story.acceptance_criteria.map(criteria => `- ${criteria}`),
    ];
    
    // 如果有非功能需求，也添加进去
    if (story.non_functional_requirements && story.non_functional_requirements.length > 0) {
      storyContent.push(`非功能需求:`);
      storyContent.push(...story.non_functional_requirements.map(req => `- ${req}`));
    }
    
    // 复制到剪贴板
    navigator.clipboard.writeText(storyContent.join('\n'))
      .then(() => {
        toast({
          title: "已复制到剪贴板",
          description: `用户故事 #${index + 1} 的内容已复制，可用于后续步骤`,
          duration: 3000,
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        toast({
          title: "复制失败",
          description: "无法复制到剪贴板，请手动复制",
          variant: "destructive",
          duration: 3000,
        });
      });
  };
  
  return (
    <Card className="mb-4 border border-gray-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-2 bg-gradient-to-r from-orange-50 to-white">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-orange-700">
              用户故事 #{index + 1}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px]">
                {featureName}
              </Badge>
              <div className="flex space-x-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0" 
                  onClick={handleCopy}
                  title="复制用户故事内容"
                >
                  <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-green-600" />
                </Button>
                {onEdit && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => onEdit(story, featureIndex, index)}
                    title="编辑用户故事"
                  >
                    <Edit className="h-3.5 w-3.5 text-gray-500 hover:text-blue-600" />
                  </Button>
                )}
                {onDelete && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => onDelete(featureIndex, index)}
                    title="删除用户故事"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs font-medium text-gray-700">{story.story}</p>
        </div>
      </CardHeader>
      <CardContent className="pt-3 pb-3 space-y-3">
        <div>
          <h4 className="text-[10px] font-medium text-gray-500 mb-1">描述</h4>
          <p className="text-sm text-gray-700">{story.description}</p>
        </div>
        
        {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">验收标准</h4>
            <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
              {story.acceptance_criteria.map((criteria, idx) => (
                <li key={idx}>{criteria}</li>
              ))}
            </ul>
          </div>
        )}
        
        {story.non_functional_requirements && story.non_functional_requirements.length > 0 && (
          <div>
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">非功能需求</h4>
            <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
              {story.non_functional_requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 