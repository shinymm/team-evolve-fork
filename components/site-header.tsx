'use client'

import { Long_Cang } from 'next/font/google'
// import Link from 'next/link' // Replaced by i18n Link
import { useSession } from 'next-auth/react'
import { useSystemStore } from '@/lib/stores/system-store'
import { UserMenu } from './auth/user-menu'
import { useTranslations, useLocale } from 'next-intl'; // Added
import { Link, usePathname } from '@/i18n/navigation'; // Added i18n Link
import { Globe } from 'lucide-react'
import { routing } from '@/i18n/routing'

const longCang = Long_Cang({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: false,  // 禁用预加载
  adjustFontFallback: false  // 禁用字体回退调整
})

export function SiteHeader() {
  const t = useTranslations('SiteHeader'); // Added
  const { data: session, status } = useSession()
  const { selectedSystemId, systems } = useSystemStore()
  const pathname = usePathname()
  const locale = useLocale();
  const targetLocale = locale === 'en' ? 'zh' : 'en';

  // 获取目标语言的显示名称
  const targetLanguageDisplay = locale === 'en' ? '中文' : 'English';

  const selectedSystem = systems.find(system => system.id === selectedSystemId)
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gray-900">
      <div className="flex h-14 items-center px-4 justify-between">
        <div className="w-1/4">
          <Link href="/" className="text-xl hover:opacity-80">
            <span className="font-bold tracking-tight text-white">
              {t('teamNamePrefix')}
            </span>
            <span className="font-weibei text-orange-500 ml-1 text-2xl">
              {t('otherworld')}
            </span>
            {selectedSystem && (
              <span className="text-white ml-3 text-lg">
                · {selectedSystem.name}
              </span>
            )}
          </Link>
        </div>
        <div className="hidden md:flex flex-1 justify-center items-center space-x-8">
          <span className={`text-base text-gray-300 hover:text-orange-400 transition-colors duration-200 ${longCang.className}`}>
            {t('slogan')}
          </span>
        </div>
        <div className="w-1/4 flex justify-end items-center space-x-4">
          {/* 语言切换按钮 */}
          <Link 
            key={targetLocale + pathname}
            href={pathname}
            locale={targetLocale}
            className="flex items-center text-xs font-medium text-gray-300 hover:text-orange-400 transition-colors px-2 py-1 rounded-md border border-gray-700 hover:border-orange-400"
          >
            <Globe className="mr-1 h-3 w-3" />
            <span>{targetLanguageDisplay}</span>
          </Link>
          
          {status === 'loading' ? (
            <div className="text-sm text-gray-300">{t('loading')}</div>
          ) : session?.user ? (
            <UserMenu user={session.user} />
          ) : (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">{t('guestMode')}</span>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-colors"
              >
                {t('login')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
} 