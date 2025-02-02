import Image from 'next/image'
import Link from 'next/link'

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
        <h1 className="text-3xl font-bold text-gray-800 mt-6 mb-48">
          知识驱动能力破界，AI召唤协作灵感
        </h1>
        <Link 
          href="/knowledge/information-architecture" 
          className="inline-block px-8 py-3 text-2xl font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
        >
          启程入阵
        </Link>
      </div>
    </div>
  )
}

