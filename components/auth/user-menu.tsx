'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { User } from 'next-auth'
import { ChevronDown, LogOut, User as UserIcon, Settings } from 'lucide-react'
import { AccountManagementModal } from '@/components/account/account-management-modal'
import { useTranslations } from 'next-intl'

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const t = useTranslations('UserMenu')

  const toggleMenu = () => setIsOpen(!isOpen)

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  const openAccountModal = () => {
    setIsAccountModalOpen(true)
    setIsOpen(false)
  }

  // 获取用户名首字母作为头像
  const userInitial = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'

  return (
    <div className="relative">
      <button
        onClick={toggleMenu}
        className="flex items-center space-x-2 text-white focus:outline-none"
      >
        <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white">
          {userInitial}
        </div>
        <span className="text-sm font-medium">{user.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu">
            <div className="px-4 py-2 text-sm text-gray-700 border-b">
              <div className="font-medium">{user.name}</div>
              <div className="text-gray-500 text-xs">{user.email}</div>
            </div>
            <button
              onClick={openAccountModal}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              role="menuitem"
            >
              <Settings className="w-4 h-4" />
              <span>{t('accountManagement')}</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('signOut')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 账户管理弹窗 */}
      <AccountManagementModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        userId={user.id}
      />
    </div>
  )
} 