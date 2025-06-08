import '../globals.css' 
import '../event-config' 
// import type { Metadata } from "next"
import { Inter } from 'next/font/google'
// import { Sidebar } from "@/components/sidebar"
// import { Toaster } from "@/components/ui/toaster"
// import { TooltipProvider } from "@/components/ui/tooltip"
import { SiteHeader } from "@/components/site-header"
// import { Sidebar } from "@/components/sidebar"
// import { AiTeamSidebar } from "@/components/ai-team-sidebar"
import { Providers } from '../providers'
// import { ClientLayoutWrapper } from '@/components/client-layout-wrapper'

import {NextIntlClientProvider, useMessages} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {setRequestLocale} from 'next-intl/server';
import { LayoutWithSidebar } from '@/components/layout-with-sidebar'
// import { usePathname } from 'next/navigation' // 如果不用，可以注释掉
import { StoreInitializer } from '@/lib/stores/store-initializer'

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif']
})

// export async function generateMetadata({params: {locale}}: {params: {locale: string}}) {
//   const t = await getTranslations({locale, namespace: 'Layout'});
//   return {
//     title: t('title')
//   };
// }

// 官方示例包含 generateStaticParams，用于静态生成
export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
} 

// LocaleLayout 不再需要 async，因为 messages 由 useMessages() 提供
export default function LocaleLayout({
  children,
  params: {locale}
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  // Enable static rendering
  setRequestLocale(locale);
  
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = useMessages(); 
  
  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <StoreInitializer />
            <LayoutWithSidebar>{children}</LayoutWithSidebar>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
} 