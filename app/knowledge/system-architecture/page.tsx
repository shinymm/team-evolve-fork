'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import PlantUmlViewer from '@/components/plantuml-viewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { highLevelArchitecture } from '@/lib/plantuml-templates/high-level';
import { microserviceArchitecture } from '@/lib/plantuml-templates/microservice';
import { deploymentArchitecture } from '@/lib/plantuml-templates/deployment';

type ArchitectureType = 'high-level' | 'microservice' | 'deployment';

const tabs: { id: ArchitectureType; name: string }[] = [
  { id: 'high-level', name: '高阶系统架构' },
  { id: 'microservice', name: '微服务应用架构' },
  { id: 'deployment', name: '部署架构' },
];

export default function SystemArchitecturePage() {
  const [selectedArchitecture, setSelectedArchitecture] = useState<ArchitectureType>('high-level');
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState('');

  const [architectureUml, setArchitectureUml] = useState({
    'high-level': highLevelArchitecture,
    'microservice': microserviceArchitecture,
    'deployment': deploymentArchitecture
  });

  const handleEdit = () => {
    setEditingContent(architectureUml[selectedArchitecture]);
    setIsEditing(true);
  };

  const handleSave = () => {
    setArchitectureUml(prev => ({
      ...prev,
      [selectedArchitecture]: editingContent
    }));
    setIsEditing(false);
  };

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
                  onClick={() => setSelectedArchitecture(tab.id)}
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
        <PlantUmlViewer content={architectureUml[selectedArchitecture]} />
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
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 