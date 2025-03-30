'use client'

import { Long_Cang } from 'next/font/google'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UserMenu } from './auth/user-menu'

const longCang = Long_Cang({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: false,  // 禁用预加载
  adjustFontFallback: false  // 禁用字体回退调整
})

export function SiteHeader() {
  const { data: session, status } = useSession()

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gray-900">
      <div className="flex h-14 items-center px-4">
        <div className="w-1/4">
          <Link href="/" className="text-xl hover:opacity-80">
            <span className="font-bold tracking-tight text-white">
              Team Evolve ｜ 
            </span>
            <span className="font-weibei text-orange-500 ml-1 text-2xl">
              异界
            </span>
          </Link>
        </div>
        <div className="hidden md:flex flex-1 justify-center">
          <span className="text-base text-gray-300 hover:text-orange-400 transition-colors duration-200">
            知识驱动能力破界，AI召唤协作灵感
          </span>
        </div>
        <div className="w-1/4 flex justify-end items-center">
          {status === 'loading' ? (
            <div className="text-sm text-gray-300">加载中...</div>
          ) : session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">访客模式</span>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors"
              >
                登录
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 