import { Noto_Serif_TC } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'

const notoSerifTC = Noto_Serif_TC({
  weight: ['700'],
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
              AI
            </span>
            <span className="font-kai text-orange-500 ml-1">
              異界
            </span>
          </span>
        </div>
      </div>
    </header>
  )
} 