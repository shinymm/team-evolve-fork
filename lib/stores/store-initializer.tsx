'use client'

import { useEffect } from 'react'

// 这个组件用于初始化所有全局store
export function StoreInitializer() {
  useEffect(() => {
    // 可以在这里添加其他store的初始化逻辑
  }, [])
  
  // 这个组件不渲染任何内容
  return null
} 