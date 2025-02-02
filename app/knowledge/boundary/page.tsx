'use client'

import { BoundaryRules } from "@/components/boundary-rules"

export default function BoundaryPage() {
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">边界识别知识</h1>
        <p className="mt-2 text-sm text-gray-500">
          这里展示了边界识别的规则和示例，帮助你更好地进行需求分析。
        </p>
      </div>
      <BoundaryRules />
    </div>
  )
} 