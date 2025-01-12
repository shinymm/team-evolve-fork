import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { ToastProvider } from "@/components/providers/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "QARE TeamAI",
  description: "Knowledge Base Management System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <TooltipProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <div className="flex-1 flex">
              <Sidebar />
              <main className="flex-1 p-6">
                {children}
              </main>
            </div>
          </div>
          <Toaster />
          <ToastProvider />
        </TooltipProvider>
      </body>
    </html>
  )
}

