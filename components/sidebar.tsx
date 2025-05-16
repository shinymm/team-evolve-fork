'use client'

import { ChevronDown, Settings, Database, Microscope, ListChecks, BookOpenIcon, Flame, Hexagon, Sparkles } from 'lucide-react'
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useSession } from 'next-auth/react'
import { getPathPermission } from '@/config/permissions'
import { toast } from '@/components/ui/use-toast'

type UserRole = 'USER' | 'ADMIN'

interface MenuItem {
  title: string
  icon: React.ReactNode
  href?: string
  submenu?: {
    title: string
    href: string
    isPro?: boolean
  }[]
}

// 将设置菜单从主菜单中分离出来
const mainMenuItems: MenuItem[] = [
  {
    title: "异界进化",
    icon: <Hexagon className="h-4 w-4" />,
    submenu: [
      { title: "战术板", href: "/collaboration/tactical-board" }
    ]
  },
  {
    title: "AI能力胶囊",
    icon: <Microscope className="h-4 w-4" />,
    submenu: [
      { title: "原始需求分析", href: "/ai-capability/book-evolution" },
      { title: "需求初稿衍化", href: "/ai-capability/book" },
      { title: "场景边界分析", href: "/ai-capability/scene-analysis" },
      { title: "需求书确认", href: "/ai-capability/book-confirm" },
      { title: "需求书撰写", href: "/ai-capability/book-writing", isPro: true },
      { title: "用户故事拆解", href: "/ai-capability/user-story" },
      { title: "测试用例生成", href: "/ai-capability/test-cases" },
      { title: "测试描述格式化", href: "/ai-capability/test-format" },
      { title: "测试用例细节辅助", href: "/ai-capability/test-detail" },
      { title: "日志分析", href: "/ai-capability/log-analysis" },
    ]
  },
  {
    title: "知识熔炉",
    icon: <Database className="h-4 w-4" />,
    submenu: [
      { title: "产品信息架构", href: "/knowledge/information-architecture" },
      { title: "产品系统架构", href: "/knowledge/system-architecture" },
      { title: "产品开放API", href: "/knowledge/api-interfaces" },
      { title: "术语管理", href: "/knowledge/glossary" },
      { title: "需求摘要管理", href: "/knowledge/requirement-summaries" },
      { title: "需求书模版", href: "/knowledge/requirement-templates" },
      { title: "边界识别知识", href: "/knowledge/boundary", isPro: true },
    ]
  },
  {
    title: "灵犀阁",
    icon: <Sparkles className="h-4 w-4" />,
    submenu: [
      { title: "需求分析技能", href: "/inspire/req-analysis-skill", isPro: true },
      { title: "文档综合处理", href: "/special-capability/requirement-upload", isPro: true },
      { title: "图片综合处理", href: "/special-capability/image-processing", isPro: true }
    ]
  },
  {
    title: "AI能力生态",
    icon: <Flame className="h-4 w-4" />,
    submenu: [
      { title: "AI团队工厂", href: "/settings/ai-team" }
      
    ]
  }
]

const settingsMenu: MenuItem = {
  title: "设置",
  icon: <Settings className="h-4 w-4" />,
  submenu: [
    { title: "大模型设置", href: "/settings/ai-models" },
    { title: "提示词调试", href: "/special-capability/prompt-debug"}
  ]
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [openMenus, setOpenMenus] = useState<string[]>(["AI能力胶囊"])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [navigating, setNavigating] = useState<string | null>(null)

  useEffect(() => {
    mainMenuItems.forEach(item => {
      item.submenu?.forEach(subitem => {
        router.prefetch(subitem.href)
      })
    })
    settingsMenu.submenu?.forEach(subitem => {
      router.prefetch(subitem.href)
    })
  }, [router])

  const toggleMenu = (title: string) => {
    setOpenMenus(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    )
  }

  const canAccessPath = (path: string) => {
    const permission = getPathPermission(path)

    if (!permission) return true
    if (!permission.requiresAuth) return true
    if (!session?.user) return false
    if (!permission.allowedRoles) return true
    const userRole = session.user.role as UserRole
    return permission.allowedRoles.includes(userRole)
  }

  const handleNavigate = async (href: string) => {
    if (!canAccessPath(href)) {
      toast({
        title: "访问受限",
        description: "您需要登录或没有权限访问此功能",
        variant: "destructive"
      })
      return
    }

    if (href !== pathname) {
      setNavigating(href)
      await router.push(href)
      setNavigating(null)
    }
  }

  useEffect(() => {
    setNavigating(null)
  }, [pathname])

  const renderMenuItem = (item: MenuItem) => {
    if (!item.submenu) return null

    // 检查是否有任何可访问的子菜单
    const hasAccessibleSubmenu = item.submenu.some(sub => canAccessPath(sub.href))
    if (!hasAccessibleSubmenu) return null

    return (
      <div key={item.title} className="mb-0">
        <div
          className="w-full flex items-center justify-between px-1.5 py-1 text-[12px] text-gray-600 font-medium bg-gray-100/80 rounded-md cursor-default select-none"
        >
          <div className="flex items-center gap-1">
            {item.icon}
            <span>{item.title}</span>
          </div>
          <ChevronDown
            className={`h-2.5 w-2.5 transition-transform text-gray-400 ${
              openMenus.includes(item.title) ? "transform rotate-180" : ""
            }`}
            onClick={() => toggleMenu(item.title)}
          />
        </div>
        {openMenus.includes(item.title) && (
          <div className="space-y-0">
            {item.submenu.map((subitem) => {
              const isAccessible = canAccessPath(subitem.href)
              return (
                <button
                  key={subitem.href}
                  onClick={() => handleNavigate(subitem.href)}
                  className={`w-full text-left pl-6 pr-1 py-1 text-[12px] relative block
                    ${!isAccessible ? 'opacity-50 cursor-not-allowed' : 'hover:bg-orange-100 hover:text-orange-700'}
                    ${pathname === subitem.href ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700"}
                    ${navigating === subitem.href ? "opacity-70" : ""}`}
                  disabled={navigating === subitem.href || !isAccessible}
                >
                  <span className="relative inline-block">
                    {subitem.title}
                    {subitem.isPro && (
                      <span className="absolute -top-0.5 -right-5 text-[8px] font-semibold text-orange-600">
                        PRO
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-40 border-r bg-gray-50/50 h-[calc(100vh-3.5rem)] sticky top-14 flex flex-col">
      {/* 主菜单区域 */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-1 space-y-1">
          {mainMenuItems.map(renderMenuItem)}
        </nav>
      </div>

      {/* 设置菜单区域 - 固定在底部 */}
      <div className="border-t">
        <div className="p-0.5">
          {renderMenuItem(settingsMenu)}
        </div>
      </div>
    </div>
  )
}

