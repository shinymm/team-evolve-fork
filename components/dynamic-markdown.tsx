'use client'

import dynamic from 'next/dynamic'
import React from 'react'

// 加载中的组件
const LoadingComponent = () => (
  <div className="animate-pulse bg-gray-100 p-4 rounded-md min-h-[200px]">
    加载内容中...
  </div>
)

// @ts-ignore - 使用ts-ignore跳过类型检查
const DynamicReactMarkdown = dynamic(
  // @ts-ignore - 使用ts-ignore跳过类型检查
  () => import('react-markdown'),
  {
    ssr: false,
    loading: LoadingComponent
  }
)

// 封装组件的属性类型
interface DynamicMarkdownProps {
  children: string
  remarkPlugins?: any[]
  className?: string
}

// 导出组件
export default function DynamicMarkdown({ 
  children, 
  remarkPlugins = [], 
  className 
}: DynamicMarkdownProps) {
  return (
    <div className={className}>
      {/* @ts-ignore - 使用ts-ignore跳过类型检查 */}
      <DynamicReactMarkdown remarkPlugins={remarkPlugins}>
        {children}
      </DynamicReactMarkdown>
    </div>
  )
} 