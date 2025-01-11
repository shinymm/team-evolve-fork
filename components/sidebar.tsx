'use client'

import { ChevronDown, Settings, Database, Microscope, ListChecks } from 'lucide-react'
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

const menuItems: MenuItem[] = [
  {
    title: "需求辅助",
    icon: <Microscope className="h-4 w-4" />,
    submenu: [
      { title: "需求边界分析", href: "/requirements/boundary-analysis" },
    ]
  },
  {
    title: "测试辅助",
    icon: <ListChecks className="h-4 w-4" />,
    submenu: [
      { title: "测试用例辅助", href: "/requirements/test-cases" },
      { title: "测试描述格式化", href: "/requirements/test-format" },
    ]
  },
  {
    title: "知识库",
    icon: <Database className="h-4 w-4" />,
    submenu: [
      { title: "边界识别知识", href: "/knowledge/boundary" },
    ]
  },
  {
    title: "设置",
    icon: <Settings className="h-4 w-4" />,
    submenu: [
      { title: "大模型设置", href: "/settings/ai-models" },
    ]
  }
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  // 默认展开所有菜单
  const [openMenus, setOpenMenus] = useState<string[]>(
    menuItems.map(item => item.title)
  )
  const [navigating, setNavigating] = useState<string | null>(null)

  useEffect(() => {
    menuItems.forEach(item => {
      item.submenu?.forEach(subitem => {
        router.prefetch(subitem.href)
      })
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
    <div className="w-48 border-r bg-gray-50/50 h-[calc(100vh-3.5rem)] sticky top-14">
      <nav className="p-1 space-y-1">
        {menuItems.map((item) => (
          <div key={item.title} className="mb-1">
            <div
              className="w-full flex items-center justify-between p-2 text-sm text-gray-600 font-medium bg-gray-100/80 rounded-md cursor-default select-none"
            >
              <div className="flex items-center gap-2">
                {item.icon}
                <span>{item.title}</span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform text-gray-400 ${
                  openMenus.includes(item.title) ? "transform rotate-180" : ""
                }`}
                onClick={() => toggleMenu(item.title)}
              />
            </div>
            {openMenus.includes(item.title) && item.submenu && (
              <div className="mt-1 space-y-0.5">
                {item.submenu.map((subitem) => (
                  <button
                    key={subitem.href}
                    onClick={() => handleNavigate(subitem.href)}
                    className={`w-full text-left pl-8 pr-2 py-1.5 rounded-md text-sm 
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
  )
}

