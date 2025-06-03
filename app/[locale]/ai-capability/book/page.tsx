import dynamic from 'next/dynamic'

// 动态导入RequirementBookClient组件
const RequirementBookClient = dynamic(() => import('@/lib/services/requirement-book-client').then(mod => ({ default: mod.RequirementBookClient })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      <p className="mt-2 text-sm text-gray-500">需求书加载中...</p>
    </div>
  </div>
})

export default function RequirementBookPage() {
  return <RequirementBookClient />;
} 