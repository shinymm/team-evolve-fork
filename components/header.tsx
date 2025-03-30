'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UserMenu } from './auth/user-menu'

export function Header() {
  const { data: session, status } = useSession()

  return (
    <header className="bg-[#1e4694] text-white h-14 flex items-center px-6 sticky top-0 z-50">
      <Link href="/" className="text-xl font-bold">
        QARE TeamAI
      </Link>

      <div className="ml-auto flex items-center space-x-4">
        {status === 'loading' ? (
          <div className="text-sm">加载中...</div>
        ) : session?.user ? (
          <UserMenu user={session.user} />
        ) : (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">访客模式</span>
            <Link
              href="/auth/signin"
              className="text-sm font-medium hover:text-orange-200 transition-colors"
            >
              登录
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

