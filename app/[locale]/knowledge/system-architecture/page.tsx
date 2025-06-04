'use client';

import { useState, useEffect } from 'react';
import { Settings, Loader2, Plus } from 'lucide-react';
import PlantUmlViewer from '@/components/plantuml-viewer';
import { useSystemStore } from '@/lib/stores/system-store';
import { useToast } from "@/components/ui/use-toast";
import { highLevelArchitecture as defaultHighLevelArchitecture } from '@/lib/plantuml-templates/high-level';
import { microserviceArchitecture as defaultMicroserviceArchitecture } from '@/lib/plantuml-templates/microservice';
import { deploymentArchitecture as defaultDeploymentArchitecture } from '@/lib/plantuml-templates/deployment';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

// 动态导入UI组件
const Dialog = dynamic(() => import('@/components/ui/dialog').then(mod => mod.Dialog))
const DialogContent = dynamic(() => import('@/components/ui/dialog').then(mod => mod.DialogContent))
const DialogHeader = dynamic(() => import('@/components/ui/dialog').then(mod => mod.DialogHeader))
const DialogTitle = dynamic(() => import('@/components/ui/dialog').then(mod => mod.DialogTitle))
const Button = dynamic(() => import('@/components/ui/button').then(mod => mod.Button))
const Textarea = dynamic(() => import('@/components/ui/textarea').then(mod => mod.Textarea))
const Input = dynamic(() => import('@/components/ui/input').then(mod => mod.Input))
const Tabs = dynamic(() => import('@/components/ui/tabs').then(mod => mod.Tabs))
const TabsList = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsList))
const TabsTrigger = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsTrigger))
const TabsContent = dynamic(() => import('@/components/ui/tabs').then(mod => mod.TabsContent))
const Card = dynamic(() => import('@/components/ui/card').then(mod => mod.Card))
const CardContent = dynamic(() => import('@/components/ui/card').then(mod => mod.CardContent))
const CardHeader = dynamic(() => import('@/components/ui/card').then(mod => mod.CardHeader))
const CardTitle = dynamic(() => import('@/components/ui/card').then(mod => mod.CardTitle))
const CardDescription = dynamic(() => import('@/components/ui/card').then(mod => mod.CardDescription))
const CardFooter = dynamic(() => import('@/components/ui/card').then(mod => mod.CardFooter))
const AlertDialog = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialog))
const AlertDialogAction = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogAction))
const AlertDialogCancel = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogCancel))
const AlertDialogContent = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogContent))
const AlertDialogDescription = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogDescription))
const AlertDialogFooter = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogFooter))
const AlertDialogHeader = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogHeader))
const AlertDialogTitle = dynamic(() => import('@/components/ui/alert-dialog').then(mod => mod.AlertDialogTitle))

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
  const t = useTranslations('SystemArchitecturePage');
  
  // 定义国际化后的tab名称
  const tabNames = {
    'high-level': t('highLevel'),
    'microservice': t('microservice'),
    'deployment': t('deployment')
  };
  
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
      if (!response.ok) throw new Error(t('fetchFailed'));
      const data = await response.json();
      setArchitecture(data);
    } catch (error) {
      console.error(t('fetchFailed'), error);
      toast({
        title: t('fetchFailed'),
        description: error instanceof Error ? error.message : t('fetchFailed'),
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

      if (!response.ok) throw new Error(t('saveFailed'));
      
      const data = await response.json();
      setArchitecture(data);
      setIsEditing(false);
      toast({
        title: t('saveSuccess'),
        description: t('saveSuccessDesc'),
        variant: "default"
      });
    } catch (error) {
      console.error(t('saveFailed'), error);
      toast({
        title: t('saveFailed'),
        description: error instanceof Error ? error.message : t('saveFailed'),
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
        <p className="text-gray-500">{t('selectSystem')}</p>
      </div>
    );
  }

  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('subtitle')}
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
                      if (confirm(t('confirmSwitch'))) {
                        setIsEditing(false);
                        setSelectedArchitecture(tab.id);
                      }
                    } else {
                      setSelectedArchitecture(tab.id);
                    }
                  }}
                >
                  {tabNames[tab.id]}
                  {selectedArchitecture === tab.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit();
                      }}
                      className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                      title={t('editPlantUML')}
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
            <span className="ml-2 text-gray-500">{t('loading')}</span>
          </div>
        ) : architecture ? (
          getArchitectureContent(selectedArchitecture) ? (
            <PlantUmlViewer content={getArchitectureContent(selectedArchitecture)} />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>{t('addArchitecture', { 
                  type: selectedArchitecture === 'high-level' ? t('highLevel') : 
                        selectedArchitecture === 'microservice' ? t('microservice') : 
                        t('deployment') 
                })}</CardTitle>
                <CardDescription>
                  {t('addDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <Button onClick={handleEdit} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('startCreate')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            {t('noArchitecture')}
          </div>
        )}
      </div>

      {isEditing && (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {selectedArchitecture === 'high-level' ? t('highLevel') : 
                 selectedArchitecture === 'microservice' ? t('microservice') : 
                 t('deployment')}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
              <Textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="@startuml\n...\n@enduml"
                className="flex-1 font-mono text-sm resize-none overflow-auto"
              />
              <div className="mt-4 flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    t('save')
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 