'use client'

import { Toaster } from "@/components/ui/toaster"

export function ToastProvider() {
  return (
    <Toaster duration={3000} /> // 设置 3 秒后自动消失
  )
} 