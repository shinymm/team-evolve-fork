import { Long_Cang } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'

const longCang = Long_Cang({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gray-900">
      <div className="flex h-14 items-center">
        <div className="pl-4 flex items-center">
          <span className="text-xl">
            <span className="font-bold tracking-tight text-white">
              AI Evolve ｜ 
            </span>
            <span className="font-weibei text-orange-500 ml-1 text-2xl">
              异界
            </span>
          </span>
        </div>
      </div>
    </header>
  )
} 