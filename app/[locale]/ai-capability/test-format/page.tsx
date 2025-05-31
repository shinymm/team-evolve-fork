import { TestFormatAssistant } from '@/components/test-format-assistant'
import { useTranslations } from 'next-intl'

export default function TestFormatPage() {
  const t = useTranslations('TestFormatPage')
  
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