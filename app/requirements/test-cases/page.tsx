import { TestCaseAssistant } from '@/components/test-case-assistant'

export default function TestCasesPage() {
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">测试用例生成</h1>
        <p className="mt-2 text-sm text-gray-500">
          基于需求描述，自动生成测试用例。
        </p>
      </div>

      <TestCaseAssistant />
    </div>
  )
} 