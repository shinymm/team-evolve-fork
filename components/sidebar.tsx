'use client'

import { ChevronDown, Settings, Database, Microscope, ListChecks, BookOpenIcon, Flame, Hexagon, Sparkles } from 'lucide-react'
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"

interface MenuItem {
  title: string
  icon: React.ReactNode
  href?: string
  submenu?: {
    title: string
    href: string
  }[]
}

// 将设置菜单从主菜单中分离出来
const mainMenuItems: MenuItem[] = [
  {
    title: "异界进化",
    icon: <Hexagon className="h-4 w-4" />,
    submenu: [
      { title: "战术板", href: "/page/collaboration/tactical-board" }
    ]
  },
  {
    title: "AI能力胶囊",
    icon: <Microscope className="h-4 w-4" />,
    submenu: [
      { title: "原始需求分析", href: "/page/ai-capability/book-evolution" },
      { title: "需求初稿衍化", href: "/page/ai-capability/book" },
      { title: "场景边界分析", href: "/page/ai-capability/scene-analysis" },
      { title: "需求书确认", href: "/page/ai-capability/book-confirm" },
      { title: "用户故事拆解", href: "/page/ai-capability/user-story" },
      { title: "测试用例生成", href: "/page/ai-capability/test-cases" },
      { title: "测试描述格式化", href: "/page/ai-capability/test-format" },
      { title: "测试用例细节辅助", href: "/page/ai-capability/test-detail" },
      { title: "日志分析", href: "/page/ai-capability/log-analysis" },
    ]
  },
  {
    title: "特殊能力胶囊",
    icon: <Flame className="h-4 w-4" />,
    submenu: [
      { title: "需求书综合处理", href: "/page/special-capability/requirement-upload" }
    ]
  },
  {
    title: "知识熔炉",
    icon: <Database className="h-4 w-4" />,
    submenu: [
      { title: "术语管理", href: "/page/knowledge/glossary" },
      { title: "产品信息架构", href: "/page/knowledge/information-architecture" },
      { title: "系统架构", href: "/page/knowledge/system-architecture" },
      { title: "API 开放接口", href: "/page/knowledge/api-interfaces" },
      { title: "边界识别知识", href: "/page/knowledge/boundary" },
    ]
  },
  {
    title: "灵犀阁",
    icon: <Sparkles className="h-4 w-4" />,
    submenu: [
      { title: "需求分析技能", href: "/page/inspire/req-analysis-skill" }
    ]
  }
]

const settingsMenu: MenuItem = {
  title: "设置",
  icon: <Settings className="h-4 w-4" />,
  submenu: [
    { title: "大模型设置", href: "/page/settings/ai-models" },
  ]
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [openMenus, setOpenMenus] = useState<string[]>(mainMenuItems.map(item => item.title))
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

  const handleNavigate = (href: string) => {
    if (href !== pathname) {
      setNavigating(href)
      router.push(href)
    }
  }

  useEffect(() => {
    setNavigating(null)
  }, [pathname])

  return (
    <div className="w-48 border-r bg-gray-50/50 h-[calc(100vh-3.5rem)] sticky top-14 flex flex-col">
      {/* 主菜单区域 */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-1 space-y-1.5">
          {mainMenuItems.map((item) => (
            <div key={item.title} className="mb-0.5">
              <div
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-gray-600 font-medium bg-gray-100/80 rounded-md cursor-default select-none"
              >
                <div className="flex items-center gap-1.5">
                  {item.icon}
                  <span>{item.title}</span>
                </div>
                <ChevronDown
                  className={`h-3 w-3 transition-transform text-gray-400 ${
                    openMenus.includes(item.title) ? "transform rotate-180" : ""
                  }`}
                  onClick={() => toggleMenu(item.title)}
                />
              </div>
              {openMenus.includes(item.title) && item.submenu && (
                <div className="mt-0.5 space-y-0">
                  {item.submenu.map((subitem) => (
                    <button
                      key={subitem.href}
                      onClick={() => handleNavigate(subitem.href)}
                      className={`w-full text-left pl-7 pr-2 py-1 rounded-md text-xs 
                        hover:bg-orange-50 hover:text-orange-700 transition-colors
                        ${pathname === subitem.href 
                          ? "bg-orange-50 text-orange-700 font-medium" 
                          : "text-gray-700"
                        }
                        ${navigating === subitem.href ? "opacity-70" : ""}`}
                      disabled={navigating === subitem.href}
                    >
                      {subitem.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* 设置菜单区域 - 固定在底部 */}
      <div className="border-t">
        <div className="p-0.5">
          <div className="mb-0.5">
            <div
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-gray-600 font-medium bg-gray-100/80 rounded-md cursor-default select-none"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <div className="flex items-center gap-1.5">
                {settingsMenu.icon}
                <span>{settingsMenu.title}</span>
              </div>
              <ChevronDown
                className={`h-3 w-3 transition-transform text-gray-400 ${
                  isSettingsOpen ? "transform rotate-180" : ""
                }`}
              />
            </div>
            {isSettingsOpen && settingsMenu.submenu && (
                <div className="mt-0.5 space-y-0">
                  {settingsMenu.submenu.map((subitem) => (
                    <button
                      key={subitem.href}
                      onClick={() => handleNavigate(subitem.href)}
                      className={`w-full text-left pl-7 pr-2 py-1 rounded-md text-xs 
                        hover:bg-orange-50 hover:text-orange-700 transition-colors
                        ${pathname === subitem.href 
                          ? "bg-orange-50 text-orange-700 font-medium" 
                          : "text-gray-700"
                        }
                        ${navigating === subitem.href ? "opacity-70" : ""}`}
                      disabled={navigating === subitem.href}
                    >
                      {subitem.title}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

