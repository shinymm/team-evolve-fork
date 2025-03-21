'use client'

import { TestDetailAssistant } from "@/components/test-detail-assistant"

export default function TestDetailPage() {
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">测试用例细节辅助</h1>
        <p className="mt-2 text-sm text-gray-500">
          补充测试用例的细节信息，提高测试覆盖率。
        </p>
      </div>

      <TestDetailAssistant />
    </div>
  )
} 