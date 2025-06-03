import React, { useState, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Copy, Send } from "lucide-react";
import { useSystemStore } from '@/lib/stores/system-store';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

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

export const UserStoryCard = forwardRef<HTMLDivElement, UserStoryCardProps>(function UserStoryCard(props, ref) {
  const { story, featureName, index, onEdit, onDelete, featureIndex } = props;
  const t = useTranslations('UserStoryPage');
  const [isSendingToJira, setIsSendingToJira] = useState(false);
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [jiraTaskKey, setJiraTaskKey] = useState('');
  
  // 获取当前系统名称
  const { systems, selectedSystemId } = useSystemStore();
  const selectedSystem = systems.find(sys => sys.id === selectedSystemId);
  const systemName = selectedSystem?.name || '';
  
  const handleCopy = () => {
    // 格式化用户故事内容
    const storyContent = [
      `${t('userStory')}: ${story.story}`,
      `${t('description')}: ${story.description}`,
      `${t('acceptanceCriteria')}:`,
      ...story.acceptance_criteria.map(criteria => `- ${criteria}`),
    ];
    
    // 如果有非功能需求，也添加进去
    if (story.non_functional_requirements && story.non_functional_requirements.length > 0) {
      storyContent.push(`${t('nonFunctionalRequirements')}:`);
      storyContent.push(...story.non_functional_requirements.map(req => `- ${req}`));
    }
    
    // 复制到剪贴板
    navigator.clipboard.writeText(storyContent.join('\n'))
      .then(() => {
        // 显示复制成功的弹窗
        setJiraTaskKey('');
        setShowJiraDialog(true);
      })
      .catch(err => {
        console.error('复制失败:', err);
        alert(t('copyFailed'));
      });
  };
  
  // 发送到Jira创建任务
  const handleSendToJira = async () => {
    // 检查是否有系统名称
    if (!systemName) {
      alert(t('noSystemSelected'));
      return;
    }
    
    setIsSendingToJira(true);
    
    try {
      // 将标题和描述分开传递
      const summary = `${story.story}`;
      
      // 构建描述内容，将所有信息都放入描述中
      const description = `
### ${t('userStory')}
${story.story}

### ${t('description')}
${story.description}

### ${t('acceptanceCriteria')}
${story.acceptance_criteria.map(criteria => `- ${criteria}`).join('\n')}
${story.non_functional_requirements && story.non_functional_requirements.length > 0 ? `
### ${t('nonFunctionalRequirements')}
${story.non_functional_requirements.map(req => `- ${req}`).join('\n')}` : ''}`.trim();
      
      // 使用featureName作为标签
      const labels = [featureName];
      
      // 调用API创建Jira任务
      const response = await fetch('/api/jira/task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary,
          description,
          labels,
          systemName
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Jira任务创建成功:', data.key);
        
        // 显示Jira任务创建成功的弹窗
        setJiraTaskKey(data.key);
        setShowJiraDialog(true);
      } else {
        throw new Error(data.error || t('createJiraTaskFailed'));
      }
    } catch (error) {
      console.error('创建Jira任务出错:', error);
      alert(error instanceof Error ? error.message : t('createJiraTaskFailed') + ": " + t('unknownError'));
    } finally {
      setIsSendingToJira(false);
    }
  };
  
  return (
    <>
      <Card className="mb-4 border border-gray-200 hover:shadow-md transition-shadow" ref={ref}>
        <CardHeader className="pb-2 bg-gradient-to-r from-orange-50 to-white">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-orange-700">
                {t('userStory')} #{index + 1}
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
                    title={t('copyStoryContent')}
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-green-600" />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={handleSendToJira}
                    disabled={isSendingToJira || !systemName}
                    title={t('sendToJira')}
                  >
                    <Send className={`h-3.5 w-3.5 ${isSendingToJira ? 'text-gray-300' : 'text-gray-500 hover:text-blue-600'}`} />
                  </Button>
                  
                  {onEdit && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={() => onEdit(story, featureIndex, index)}
                      title={t('editUserStory')}
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
                      title={t('deleteUserStory')}
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
            <h4 className="text-[10px] font-medium text-gray-500 mb-1">{t('description')}</h4>
            <p className="text-sm text-gray-700">{story.description}</p>
          </div>
          
          {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-gray-500 mb-1">{t('acceptanceCriteria')}</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {story.acceptance_criteria.map((criteria, idx) => (
                  <li key={idx}>{criteria}</li>
                ))}
              </ul>
            </div>
          )}
          
          {story.non_functional_requirements && story.non_functional_requirements.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-gray-500 mb-1">{t('nonFunctionalRequirements')}</h4>
              <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
                {story.non_functional_requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 自定义通知弹窗 */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-orange-50 border-orange-200">
          <DialogHeader>
            <DialogTitle className="text-center text-orange-700 flex items-center justify-center gap-2">
              {jiraTaskKey ? t('taskCreationSuccess') : t('copySuccess')}
            </DialogTitle>
            <DialogDescription className="text-center pt-2">
              {jiraTaskKey 
                ? <span>{t('jiraTaskCreated')} <span className="font-bold text-orange-600">{jiraTaskKey}</span></span>
                : <span>{t('storyContentCopied')}</span>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center mt-2">
            <Button
              type="button"
              variant="default"
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => setShowJiraDialog(false)}
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// Make sure it works with Next.js dynamic imports
UserStoryCard.displayName = 'UserStoryCard'; 