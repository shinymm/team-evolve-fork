import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '认证错误 - QARE TeamAI',
  description: '登录过程中发生错误',
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            认证错误
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            登录过程中发生错误，请重试
          </p>
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/auth/signin"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            返回登录页面
          </Link>
        </div>
      </div>
    </div>
  )
} 