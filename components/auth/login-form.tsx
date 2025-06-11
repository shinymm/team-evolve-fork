'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'

export function LoginForm() {
  const router = useRouter()
  const t = useTranslations('Auth')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log('尝试登录:', { email })

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      console.log('登录结果:', result)

      if (result?.error) {
        console.error('登录错误:', result.error)
        setError(result.error)
        return
      }

        console.log('登录成功，准备重定向')
        // 登录成功，重定向到首页
        router.push('/')
        router.refresh()
    } catch (error) {
      console.error('登录异常:', error)
      setError(t('loginError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className="mt-8 space-y-6" onSubmit={onSubmit}>
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            {t('emailAddress')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
            placeholder={t('emailAddress')}
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
            placeholder={t('password')}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isLoading}
          className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? t('loginInProgress') : t('submit')}
        </button>
      </div>
    </form>
  )
} 