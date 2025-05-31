'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface SupplementDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  title: string;
  description: string;
}

export const SupplementDialog = ({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  description 
}: SupplementDialogProps) => {
  const t = useTranslations('ImageProcessingPage');
  const [text, setText] = useState('');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[150px]"
            placeholder={t('supplements.placeholder')}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('supplements.cancel')}</Button>
          <Button 
            onClick={() => onConfirm(text)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {t('supplements.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 