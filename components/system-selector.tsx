import { useEffect } from 'react'
import { useSystemStore } from '@/lib/stores/system-store'
import { useSession } from 'next-auth/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from 'next-intl';

export function SystemSelector() {
  const t = useTranslations('SystemSelector');
  const { data: session } = useSession()
  const { 
    systems,
    selectedSystemId,
    isLoading,
    error,
    setSelectedSystem,
    fetchSystems
  } = useSystemStore()

  useEffect(() => {
    if (session?.user) {
      console.log('用户已登录，开始获取系统列表')
      fetchSystems()
    }
  }, [session, fetchSystems])

  const handleSystemChange = (systemId: string) => {
    console.log('选择系统:', systemId)
    const selectedSystem = systems.find(sys => sys.id === systemId)
    if (selectedSystem) {
      console.log('设置选中的系统:', selectedSystem)
      setSelectedSystem(selectedSystem)
    }
  }

  if (!session?.user) {
    return null
  }

  if (isLoading) {
    return <div className="text-sm text-gray-300">{t('loading')}</div>
  }

  if (error) {
    return <div className="text-sm text-red-500">{t('loadFailed', { error })}</div>
  }

  return (
    <Select
      value={selectedSystemId || ''}
      onValueChange={handleSystemChange}
    >
      <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
        <SelectValue placeholder={t('selectSystemPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {systems.length === 0 ? (
          <SelectItem value="empty" disabled>
            {t('noSystemData')}
          </SelectItem>
        ) : (
          systems.map(system => (
            <SelectItem
              key={system.id}
              value={system.id}
              className="cursor-pointer"
            >
              {system.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
} 