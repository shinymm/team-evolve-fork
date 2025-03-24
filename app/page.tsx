import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] bg-white overflow-hidden -mt-16">
      <div className="text-center">
        <Image
          src="/hero-illustration.jpg"
          alt="知识驱动能力破界"
          width={300}
          height={300}
          priority
          className="mx-auto"
        />
        <h1 className="text-3xl font-bold text-gray-800 mt-6 mb-36">
          知识驱动能力破界，AI召唤协作灵感
        </h1>
        <div className="flex gap-4 justify-center">
          <Link href="/ai-capability/book-evolution">
            <Button size="lg" className="text-2xl bg-orange-500 hover:bg-orange-600">
              启程入阵
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

