'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { useSystemStore, type System } from '@/lib/stores/system-store'
import heroIllustration from '@/public/hero-illustration.jpg'

export default function SystemPage() {
  const params = useParams()
  const systemId = params.systemId as string
  const { systems, selectedSystemId, setSelectedSystem, fetchSystems } = useSystemStore()
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    async function loadSystem() {
      try {
        setIsLoading(true)
        
        // 如果系统列表为空，先获取系统列表
        if (systems.length === 0) {
          await fetchSystems()
        }
        
        // 如果当前选中的系统ID与URL中的不一致，则设置当前系统
        if (selectedSystemId !== systemId) {
          const systemToSelect = systems.find(s => s.id === systemId)
          if (systemToSelect) {
            setSelectedSystem(systemToSelect)
          }
        }
      } catch (error) {
        console.error('加载系统信息失败:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSystem()
  }, [systemId, systems, selectedSystemId, setSelectedSystem, fetchSystems])
  
  // 找到当前系统
  const currentSystem = systems.find(s => s.id === systemId)
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="text-center">
          <div className="text-gray-400">加载系统信息中...</div>
        </div>
      </div>
    )
  }
  
  if (!currentSystem) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">系统不存在</h2>
          <p className="text-gray-600">未找到ID为 {systemId} 的系统</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 min-h-[calc(100vh-14rem)] flex items-center justify-center">
      <div className="w-full bg-white p-8">
        <div className="flex flex-col items-center text-center">
          <div className="relative w-80 h-80">
            <Image 
              src={heroIllustration}
              alt="系统概览"
              className="object-contain"
              priority
              fill
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">{currentSystem.name}</h1>
          <p className="text-gray-600 text-lg max-w-3xl">{currentSystem.description || '暂无描述'}</p>
        </div>
      </div>
    </div>
  )
} 