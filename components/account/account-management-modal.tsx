'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { PlatformType } from '@/lib/types'
import { useTranslations } from 'next-intl'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Copy } from 'lucide-react'

interface AccountManagementModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

export function AccountManagementModal({ isOpen, onClose, userId }: AccountManagementModalProps) {
  const [teamEvolveKey, setTeamEvolveKey] = useState('')
  const [jiraKey, setJiraKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'generate'>('generate')
  const { toast } = useToast()
  const t = useTranslations('AccountManagement')

  // 加载用户的访问密钥
  useEffect(() => {
    if (isOpen && userId) {
      loadUserKeys()
    }
  }, [isOpen, userId])

  const loadUserKeys = async () => {
    try {
      setIsLoading(true)
      
      // 获取TeamEvolve密钥
      const teamEvolveResponse = await fetch(`/api/account/access-keys?platform=TEAM_EVOLVE`)
      if (teamEvolveResponse.ok) {
        const data = await teamEvolveResponse.json()
        if (data && data.accessKey) {
          setTeamEvolveKey(data.accessKey)
        }
      }
      
      // 获取Jira密钥
      const jiraResponse = await fetch(`/api/account/access-keys?platform=JIRA`)
      if (jiraResponse.ok) {
        const data = await jiraResponse.json()
        if (data && data.accessKey) {
          setJiraKey(data.accessKey)
        }
      }
    } catch (error) {
      console.error('加载访问密钥失败:', error)
      toast({
        title: t('loadFailed'),
        description: t('loadFailedDesc'),
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 生成随机密钥
  const generateRandomKey = () => {
    if (teamEvolveKey) {
      setConfirmAction('generate')
      setShowConfirmDialog(true)
    } else {
      // 如果没有现有密钥，直接生成
      generateKey()
    }
  }

  // 实际生成密钥的逻辑
  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+';
    const keyLength = 32;
    let result = '';
    
    // 创建一个密码安全的随机字符串
    const randomValues = new Uint8Array(keyLength);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < keyLength; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    setTeamEvolveKey(result);
    
    toast({
      title: t('keyGenerated'),
      description: t('keyGeneratedDesc'),
    });
  }

  // 复制密钥到剪贴板
  const copyTeamEvolveKey = async () => {
    if (teamEvolveKey) {
      try {
        await navigator.clipboard.writeText(teamEvolveKey);
        toast({
          title: t('keyCopied'),
          description: t('keyCopiedDesc'),
        });
      } catch (error) {
        console.error('复制密钥失败:', error);
        toast({
          title: t('copyFailed'),
          description: t('copyFailedDesc'),
          variant: 'destructive'
        });
      }
    }
  }

  // 确认对话框操作
  const handleConfirmAction = () => {
    if (confirmAction === 'generate') {
      generateKey()
    }
    setShowConfirmDialog(false)
  }

  const handleSave = async () => {
    try {
      setIsLoading(true)
      
      // 保存TeamEvolve密钥（如果提供）
      if (teamEvolveKey.trim()) {
        await fetch('/api/account/access-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            platform: 'TEAM_EVOLVE',
            accessKey: teamEvolveKey
          })
        })
      }
      
      // 保存Jira密钥（如果提供）
      if (jiraKey.trim()) {
        await fetch('/api/account/access-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            platform: 'JIRA',
            accessKey: jiraKey
          })
        })
      }
      
      toast({
        title: t('saveSuccess'),
        description: t('saveSuccessDesc')
      })
      
      onClose()
    } catch (error) {
      console.error('保存访问密钥失败:', error)
      toast({
        title: t('saveFailed'),
        description: t('saveFailedDesc'),
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[50%] w-[50%] min-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="teamEvolveKey">{t('teamEvolveKey')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="teamEvolveKey"
                  type="password"
                  value={teamEvolveKey}
                  onChange={(e) => setTeamEvolveKey(e.target.value)}
                  placeholder={t('teamEvolveKey')}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  variant="secondary" 
                  onClick={generateRandomKey}
                  disabled={isLoading}
                  type="button"
                >
                  {t('generateKey')}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={copyTeamEvolveKey}
                  disabled={isLoading || !teamEvolveKey}
                  type="button"
                  className="flex items-center gap-1"
                >
                  <Copy className="h-4 w-4" />
                  {t('copyKey')}
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                {t('teamEvolveKeyDesc')}
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="jiraKey">{t('jiraKey')}</Label>
              <Input
                id="jiraKey"
                type="password"
                value={jiraKey}
                onChange={(e) => setJiraKey(e.target.value)}
                placeholder={t('jiraKey')}
                disabled={isLoading}
              />
              <p className="text-sm text-gray-500">
                {t('jiraKeyDesc')}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'generate' && t('confirmGenerateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'generate' && t('confirmGenerateDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancelAction')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              {t('confirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 