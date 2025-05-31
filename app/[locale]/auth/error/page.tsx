import { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import {setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'Auth' })
  
  return {
    title: `${t('error')} - TeamEvolve`,
    description: t('errorDescription'),
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default function AuthErrorPage({params: {locale}}: {params: {locale: string}}) {
  setRequestLocale(locale);
  const t = useTranslations('Auth')
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('error')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('errorMessage')}
          </p>
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/auth/signin"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            {t('returnToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  )
} 