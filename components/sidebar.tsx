'use client'

import { ChevronDown, Settings, Database, HelpCircle } from 'lucide-react'
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
    icon: <HelpCircle className="h-4 w-4" />,
    submenu: [
      { title: "需求边界分析", href: "/requirements/boundary-analysis" },
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
      <nav className="p-1 space-y-0.5">
        {menuItems.map((item) => (
          <div key={item.title}>
            <button
              onClick={() => toggleMenu(item.title)}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-gray-100 text-sm"
            >
              <div className="flex items-center gap-1.5">
                {item.icon}
                <span>{item.title}</span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  openMenus.includes(item.title) ? "transform rotate-180" : ""
                }`}
              />
            </button>
            {openMenus.includes(item.title) && item.submenu && (
              <div className="ml-5 mt-0.5 space-y-0.5">
                {item.submenu.map((subitem) => (
                  <button
                    key={subitem.href}
                    onClick={() => handleNavigate(subitem.href)}
                    className={`w-full text-left px-2 py-1 rounded-lg text-xs hover:bg-gray-100 
                      ${pathname === subitem.href ? "bg-gray-100 font-medium" : ""}
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

