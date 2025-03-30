import { LoginForm } from '@/components/auth/login-form'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '登录 - QARE TeamAI',
  description: '登录到 QARE TeamAI 系统',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录到 QARE TeamAI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用您的账号登录以访问更多功能
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
} 