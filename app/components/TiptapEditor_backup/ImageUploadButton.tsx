'use client';

import React, { useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { ImagePlus } from 'lucide-react';

interface ImageUploadButtonProps {
  editor: Editor;
}

export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({ editor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      if (imageUrl) {
        editor
          .chain()
          .focus()
          .setImage({ src: imageUrl, alt: file.name })
          .run();
      }
    };
    reader.readAsDataURL(file);
    
    // 清空文件输入以便再次选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button onClick={handleClick} title="插入图片">
        <ImagePlus size={18} />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />
    </>
  );
}; 