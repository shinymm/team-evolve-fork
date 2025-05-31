import { TestFormatAssistant } from '@/components/test-format-assistant'
import { getTranslations } from 'next-intl/server'
import { setRequestLocale } from 'next-intl/server'

export default async function TestFormatPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'TestFormatPage' })
  
  return (
    <div className="w-[90%] mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      <TestFormatAssistant />
    </div>
  )
} 