'use client'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { SiteHeader } from '@/components/site-header'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t = useTranslations('SiteHeader')
  
  // 判断是否首页或 auth 页面
  // 首页可能是 / 或者 /zh 或 /en 等语言根路径
  const hideSidebar =
    pathname === '/' || 
    pathname.startsWith('/auth') ||
    pathname === '' ||
    // 匹配 /zh 或 /en 等语言首页（路径长度非常短且不包含其他部分）
    /^\/[a-z]{2}(-[A-Z]{2})?$/.test(pathname) // 匹配 /zh, /en, /zh-CN 等
    
  // 判断是否是 auth 页面
  const isAuthPage = pathname.includes('/auth/')

  // auth 页面使用简化版 header
  if (isAuthPage) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* auth 页面简化版 header */}
        <header className="h-14 border-b bg-gray-900 flex items-center px-4">
          <Link href="/" className="text-xl hover:opacity-80">
            <span className="font-bold tracking-tight text-white">
              {t('teamNamePrefix')}
            </span>
            <span className="font-weibei text-orange-500 ml-1 text-2xl">
              {t('otherworld')}
            </span>
          </Link>
        </header>
        
        {/* 内容区域 */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    )
  }

  // 非 auth 页面
  return (
    <>
      {/* 正常 header */}
      <SiteHeader />
      
      {/* 内容区域，首页不显示 sidebar */}
      {hideSidebar ? (
        <>{children}</>
      ) : (
        <div className="flex">
          <Sidebar />
          <main className="flex-1">{children}</main>
        </div>
      )}
    </>
  )
} 