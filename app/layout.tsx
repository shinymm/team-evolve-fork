import './globals.css'
import './event-config'
import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/providers/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteHeader } from "@/components/site-header"
import { AiTeamSidebar } from "@/components/ai-team-sidebar"
import { Providers } from './providers'
import { ClientLayoutWrapper } from '@/components/client-layout-wrapper'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Team Evolve",
  description: "AI驱动的研发辅助平台",
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
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
            <Toaster />
            <ToastProvider />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}

