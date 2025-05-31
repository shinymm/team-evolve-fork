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

const inter = Inter({ subsets: ["latin"] })

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
  console.log(`[Layout] 正在渲染 locale=${locale} 的布局`);
  
  if (!routing.locales.includes(locale as any)) {
    console.error(`[Layout] 无效的区域设置: ${locale}`);
    notFound();
  }

  // messages 现在通过 useMessages() 获取，它会调用 i18n/request.ts
  const messages = useMessages(); 
  
  if (!messages || Object.keys(messages).length === 0) {
    console.error(`[Layout] 未能加载 locale '${locale}' 的 messages，或 messages 为空。`);
    // 可以选择 notFound() 或显示错误信息，取决于你的策略
    // notFound(); 
  }
  
  console.log(`[Layout] 获取到的 messages for locale '${locale}', keys:`, Object.keys(messages || {}).length);
  
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