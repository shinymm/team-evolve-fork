import { LoginForm } from '@/components/auth/login-form'
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import {setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';

// 动态生成元数据
export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Auth' })
  
  return {
    title: `${t('signIn')} - TeamEvolve`,
    description: t('signInDescription'),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default function SignInPage({params: {locale}}: {params: {locale: string}}) {
  setRequestLocale(locale);
  // 使用翻译
  const t = useTranslations('Auth')
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-md w-full py-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('signInTitle')}
          </h2>
          <p className="text-lg text-gray-600">
            {t('useAccountToAccess')}
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
} 