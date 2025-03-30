'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UserMenu } from './auth/user-menu'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function Header() {
  const { data: session, status } = useSession()
  const [isNavigating, setIsNavigating] = useState(false)
  const router = useRouter()

  const handleSignIn = () => {
    setIsNavigating(true)
    router.push('/auth/signin')
  }

  return (
    <header className="bg-[#1e4694] text-white h-14 flex items-center px-6 sticky top-0 z-50">
      <Link href="/" className="text-xl font-bold">
        QARE TeamAI
      </Link>

      <div className="ml-auto flex items-center space-x-4">
        {status === 'loading' || isNavigating ? (
          <div className="text-sm">加载中...</div>
        ) : session?.user ? (
          <UserMenu user={session.user} />
        ) : (
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-300">匿名访客</span>
            <button
              onClick={handleSignIn}
              className="text-sm font-medium hover:text-orange-200 transition-colors"
            >
              登录
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

