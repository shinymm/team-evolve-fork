'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from "@/components/sidebar"
import { SiteHeader } from "@/components/site-header"
import { AiTeamSidebar } from "@/components/ai-team-sidebar"

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHomePage = pathname === '/'
  const isAuthPage = pathname.startsWith('/auth')
  
  if (isAuthPage) {
    return children
  }
  
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1 flex">
        {!isHomePage && <Sidebar />}
        <main className={`flex-1 ${isHomePage ? 'p-0' : 'p-6'}`}>
          {children}
        </main>
        {!isHomePage && <AiTeamSidebar />}
      </div>
    </div>
  )
} 