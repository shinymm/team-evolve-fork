import './globals.css'
import './event-config'
import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/providers/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteHeader } from "@/components/site-header"
import { AiTeamSidebar } from "@/components/ai-team-sidebar"
import { Providers } from './providers'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "QARE TeamAI",
  description: "AI驱动的需求分析和测试用例生成平台",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <Providers>
          <TooltipProvider>
            <div className="relative flex min-h-screen flex-col">
              <SiteHeader />
              <div className="flex-1 flex">
                <Sidebar />
                <main className="flex-1 p-6">
                  {children}
                </main>
                <AiTeamSidebar />
              </div>
            </div>
            <Toaster />
            <ToastProvider />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}

