'use client';

import { useState, useEffect } from 'react';
import { Settings, Loader2, Plus } from 'lucide-react';
import PlantUmlViewer from '@/components/plantuml-viewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSystemStore } from '@/lib/stores/system-store';
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { highLevelArchitecture as defaultHighLevelArchitecture } from '@/lib/plantuml-templates/high-level';
import { microserviceArchitecture as defaultMicroserviceArchitecture } from '@/lib/plantuml-templates/microservice';
import { deploymentArchitecture as defaultDeploymentArchitecture } from '@/lib/plantuml-templates/deployment';

export type ArchitectureType = 'high-level' | 'microservice' | 'deployment';

const tabs: { id: ArchitectureType; name: string }[] = [
  { id: 'high-level', name: '高阶系统架构' },
  { id: 'microservice', name: '微服务应用架构' },
  { id: 'deployment', name: '部署架构' },
];

interface Architecture {
  id: string;
  systemId: string;
  highLevel: string;
  microservice: string;
  deployment: string;
}

export default function SystemArchitecturePage() {
  const [selectedArchitecture, setSelectedArchitecture] = useState<ArchitectureType>('high-level');
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [architecture, setArchitecture] = useState<Architecture | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { systems, selectedSystemId } = useSystemStore();
  const { toast } = useToast();
  
  const currentSystem = systems.find(sys => sys.id === selectedSystemId);
  
  // 获取架构信息
  const fetchArchitecture = async () => {
    if (!currentSystem?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/systems/${currentSystem.id}/architecture`);
      if (!response.ok) throw new Error('获取架构信息失败');
      const data = await response.json();
      setArchitecture(data);
    } catch (error) {
      console.error('获取架构信息失败:', error);
      toast({
        title: "获取失败",
        description: error instanceof Error ? error.message : "获取架构信息失败",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 重置状态
    setArchitecture(null);
    setEditingContent('');
    setIsEditing(false);
    
    // 如果有系统 ID 则获取数据
    if (currentSystem?.id) {
      fetchArchitecture();
    }
  }, [currentSystem?.id]);

  const handleEdit = () => {
    // 确保每次编辑时都使用正确的内容
    let content = '';
    
    // 如果已有架构内容，使用现有内容
    if (architecture && getArchitectureContent(selectedArchitecture)) {
      content = getArchitectureContent(selectedArchitecture);
    } else {
      // 否则使用默认模板
      switch (selectedArchitecture) {
        case 'high-level':
          content = defaultHighLevelArchitecture;
          break;
        case 'microservice':
          content = defaultMicroserviceArchitecture;
          break;
        case 'deployment':
          content = defaultDeploymentArchitecture;
          break;
      }
    }
    
    setEditingContent(content);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentSystem?.id) return;

    setIsSaving(true);
    try {
      const type = selectedArchitecture === 'high-level' ? 'highLevel' : 
                   selectedArchitecture === 'microservice' ? 'microservice' : 'deployment';

      const response = await fetch(`/api/systems/${currentSystem.id}/architecture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: editingContent
        }),
      });

      if (!response.ok) throw new Error('保存架构信息失败');
      
      const data = await response.json();
      setArchitecture(data);
      setIsEditing(false);
      toast({
        title: "保存成功",
        description: "架构信息已更新",
        variant: "default"
      });
    } catch (error) {
      console.error('保存架构信息失败:', error);
      toast({
        title: "保存失败",
        description: error instanceof Error ? error.message : "保存架构信息失败",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getArchitectureContent = (type: ArchitectureType): string => {
    if (!architecture) return '';
    
    switch (type) {
      case 'high-level':
        return architecture.highLevel;
      case 'microservice':
        return architecture.microservice;
      case 'deployment':
        return architecture.deployment;
      default:
        return '';
    }
  };

  if (!currentSystem) {
    return (
      <div className="w-[90%] mx-auto py-8">
        <p className="text-gray-500">请先选择一个系统</p>
      </div>
    );
  }

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">系统架构</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了产品的整体系统架构、应用架构与部署架构。
        </p>
      </div>
      
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm cursor-pointer
                  ${selectedArchitecture === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <div 
                  className="flex items-center gap-2"
                  onClick={() => {
                    if (isEditing && selectedArchitecture !== tab.id) {
                      if (confirm('切换标签页将丢失未保存的更改，确定要继续吗？')) {
                        setIsEditing(false);
                        setSelectedArchitecture(tab.id);
                      }
                    } else {
                      setSelectedArchitecture(tab.id);
                    }
                  }}
                >
                  {tab.name}
                  {selectedArchitecture === tab.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                      title="编辑 PlantUML"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : architecture ? (
          getArchitectureContent(selectedArchitecture) ? (
            <PlantUmlViewer content={getArchitectureContent(selectedArchitecture)} />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>添加{tabs.find(tab => tab.id === selectedArchitecture)?.name}</CardTitle>
                <CardDescription>
                  这里还没有架构图，点击下方按钮开始创建。我们提供了模板帮助您快速开始。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <Button onClick={handleEdit} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    开始创建
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            暂无架构信息
          </div>
        )}
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-[80%] w-[80%] h-[90vh]">
          <DialogHeader>
            <DialogTitle>编辑 PlantUML</DialogTitle>
          </DialogHeader>
          <div className="flex-1 grid gap-4 py-4 h-full">
            <Textarea
              className="min-h-[calc(80vh-100px)] font-mono text-sm"
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              placeholder="输入 PlantUML 内容..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditing(false)} className="mr-2">
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 