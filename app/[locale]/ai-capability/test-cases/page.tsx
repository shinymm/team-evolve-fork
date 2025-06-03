import dynamic from 'next/dynamic'
import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'

// 动态导入TestCaseAssistant组件
const TestCaseAssistant = dynamic(() => import('@/components/test-case-assistant').then(mod => ({ default: mod.TestCaseAssistant })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      <p className="mt-2 text-sm text-gray-500">Loading...</p>
    </div>
  </div>
})

export default async function TestCasesPage({params: {locale}}: {params: {locale: string}}) {
  setRequestLocale(locale)
  const t = await getTranslations({locale, namespace: 'TestCasesPage'})
  
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      <TestCaseAssistant />
    </div>
  )
} 