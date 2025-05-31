'use client'

import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Upload, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  error: string;
}

export const UploadDialog = ({ 
  open, 
  onClose, 
  onUpload, 
  uploading,
  error
}: UploadDialogProps) => {
  const t = useTranslations('ImageProcessingPage');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  
  const validateAndSetFile = (selectedFile: File) => {
    // 支持的文件类型列表
    const validTypes = [
      'image/jpeg', 
      'image/png', 
      'image/gif', 
      'image/webp', 
      'image/bmp'
    ];
    
    // 检查文件扩展名作为备选验证方式
    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension || '')) {
      // 如果文件类型不支持，返回false
      return false;
    }

    setFile(selectedFile);
    return true;
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    validateAndSetFile(selectedFile);
  }

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.add('border-orange-500');
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500');
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dropAreaRef.current) {
      dropAreaRef.current.classList.remove('border-orange-500');
    }
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }

  const handleUpload = () => {
    if (file) {
      onUpload(file);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setFile(null);
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('uploadDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('uploadDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div 
            ref={dropAreaRef}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-200"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="text-xs text-gray-600">
                {file ? (
                  <p className="text-green-600">{t('uploadDialog.fileSelected', { fileName: file.name })}</p>
                ) : (
                  <>
                    <p>{t('uploadDialog.dragDropHint')}</p>
                    <label className="cursor-pointer text-orange-600 hover:text-orange-700">
                      {t('uploadDialog.browse')}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  </>
                )}
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setFile(null);
            onClose();
          }}>
            {t('uploadDialog.cancel')}
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={!file || uploading}
            className={file && !uploading ? 'bg-orange-500 hover:bg-orange-600' : undefined}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('uploadSection.processingFile')}
              </>
            ) : t('uploadDialog.uploadButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 