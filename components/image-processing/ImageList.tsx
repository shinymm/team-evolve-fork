'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

export interface UploadedFile {
  id: string;
  name: string;
  uploadTime: Date;
  selected?: boolean;
  provider: string;
  url?: string;
}

interface ImageListProps {
  uploadedFiles: UploadedFile[];
  isImagesExpanded: boolean; 
  setIsImagesExpanded: (expanded: boolean) => void;
  onSelectFile: (fileId: string, checked: boolean) => void;
  onDeleteFile: (fileId: string) => void;
  onUploadClick: () => void;
  processing: boolean;
  imagesLoading?: boolean;
}

export const ImageList = ({
  uploadedFiles,
  isImagesExpanded,
  setIsImagesExpanded,
  onSelectFile,
  onDeleteFile,
  onUploadClick,
  processing,
  imagesLoading = false
}: ImageListProps) => {
  
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex justify-between items-center border rounded-md p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" 
           onClick={() => setIsImagesExpanded(!isImagesExpanded)}>
        <div className="flex items-center">
          {isImagesExpanded ? 
            <ChevronDown className="h-4 w-4 mr-1.5 text-gray-500" /> : 
            <ChevronRight className="h-4 w-4 mr-1.5 text-gray-500" />
          }
          <h2 className="text-sm font-medium flex items-center">
            已上传图片（{uploadedFiles.length}）
            {imagesLoading && (
              <span className="ml-2 flex items-center text-gray-500">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                加载中...
              </span>
            )}
            {uploadedFiles.filter(f => f.selected).length > 0 && (
              <span className="text-xs ml-2 text-orange-500 font-medium">
                已选择 {uploadedFiles.filter(f => f.selected).length} 张
              </span>
            )}
          </h2>
          
          {/* 显示选中图片的小缩略图 */}
          {!isImagesExpanded && uploadedFiles.filter(f => f.selected).length > 0 && (
            <div className="flex -space-x-2 ml-3">
              {uploadedFiles.filter(f => f.selected).slice(0, 3).map(file => (
                <div key={file.id} className="h-6 w-6 rounded-full border border-white overflow-hidden bg-white">
                  <img 
                    src={file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
              {uploadedFiles.filter(f => f.selected).length > 3 && (
                <div className="h-6 w-6 rounded-full bg-gray-200 border border-white flex items-center justify-center text-xs">
                  +{uploadedFiles.filter(f => f.selected).length - 3}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isImagesExpanded && (
            <span className="text-xs text-gray-500">
              点击展开
            </span>
          )}
          <Button 
            variant="ghost"
            className="px-2 py-1 h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white" 
            onClick={(e) => {
              e.stopPropagation(); // 防止触发父元素的点击事件
              onUploadClick();
            }}
            disabled={processing}
          >
            <Upload className="h-3 w-3 mr-1" />
            上传图片
          </Button>
        </div>
      </div>
      
      {isImagesExpanded && (
        <>
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-1">
              <Button 
                onClick={(e) => {
                  // 全选/全不选文件
                  const allSelected = uploadedFiles.every(file => file.selected)
                  uploadedFiles.forEach(file => {
                    onSelectFile(file.id, !allSelected)
                  })
                }}
                variant="outline"
                className="h-7 px-2 py-1 text-xs"
                size="sm"
              >
                {uploadedFiles.every(file => file.selected) ? '取消全选' : '全选'}
              </Button>
            </div>
          )}
          
          {imagesLoading ? (
            <div className="flex justify-center items-center p-8 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>正在加载图片列表...</span>
            </div>
          ) : uploadedFiles.length === 0 ? (
            <div className="text-gray-400 text-sm p-4 text-center border border-dashed rounded-lg">
              尚未上传图片文件
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
              {uploadedFiles.map(file => (
                <div 
                  key={file.id}
                  className={`border rounded-lg overflow-hidden flex flex-col ${file.selected ? 'border-orange-500 shadow-sm' : 'border-gray-200'}`}
                >
                  <div className="relative p-2 h-48 bg-gray-50 flex items-center justify-center">
                    <img 
                      src={file.url || `https://team-evolve.oss-ap-southeast-1.aliyuncs.com/${file.id}`}
                      alt={file.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  
                  <div className="p-2 border-t bg-white">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(file.uploadTime).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          来源: {file.provider}
                        </p>
                      </div>
                      
                      <div className="flex items-center ml-2">
                        <Checkbox 
                          checked={file.selected}
                          onCheckedChange={(checked) => onSelectFile(file.id, checked as boolean)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-2">
                      <Button 
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => onDeleteFile(file.id)}
                      >
                        <Trash2 className="h-3 w-3 text-gray-500 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
} 