'use client'

import { TabType } from '@/types/image-processing'

interface TabsNavigationProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export const TabsNavigation = ({
  activeTab,
  onTabChange
}: TabsNavigationProps) => {
  return (
    <div className="flex border-b border-gray-200">
      <button
        className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
          activeTab === 'product-info' 
          ? 'border-orange-500 text-orange-600 bg-orange-50' 
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }`}
        onClick={() => onTabChange('product-info')}
      >
        产品信息
      </button>
      <button
        className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
          activeTab === 'architecture' 
          ? 'border-orange-500 text-orange-600 bg-orange-50' 
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }`}
        onClick={() => onTabChange('architecture')}
      >
        信息架构
      </button>
      <button
        className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
          activeTab === 'vision-analysis' 
          ? 'border-orange-500 text-orange-600 bg-orange-50' 
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }`}
        onClick={() => onTabChange('vision-analysis')}
      >
        视觉分析
      </button>
      <button
        className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
          activeTab === 'requirement-draft' 
          ? 'border-orange-500 text-orange-600 bg-orange-50' 
          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }`}
        onClick={() => onTabChange('requirement-draft')}
      >
        需求初稿
      </button>
    </div>
  )
} 