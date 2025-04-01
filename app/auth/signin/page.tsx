import { LoginForm } from '@/components/auth/login-form'
import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '登录 - TeamEvolve',
  description: '登录到 TeamEvolve 系统',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* 简化版header */}
      <header className="h-14 border-b bg-gray-900 flex items-center px-4">
        <Link href="/" className="text-xl hover:opacity-80">
          <span className="font-bold tracking-tight text-white">
            Team Evolve ｜ 
          </span>
          <span className="font-weibei text-orange-500 ml-1 text-2xl">
            异界
          </span>
        </Link>
      </header>

      {/* 登录表单区域 */}
      <main className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-md w-full py-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              登录到 TeamEvolve
            </h2>
            <p className="text-lg text-gray-600">
              使用您的账号登录以访问更多功能
            </p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  )
} 