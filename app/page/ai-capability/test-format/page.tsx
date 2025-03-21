import { TestFormatAssistant } from '@/components/test-format-assistant'

export default function TestFormatPage() {
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">测试描述格式化</h1>
        <p className="mt-2 text-sm text-gray-500">
          规范化测试用例描述，使其更加清晰易读。
        </p>
      </div>

      <TestFormatAssistant />
    </div>
  )
} 