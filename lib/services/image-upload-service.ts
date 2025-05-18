/**
 * 图片上传服务
 * 负责处理图片上传、删除等功能
 */

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  uploadTime: Date;
  selected?: boolean;
  provider: string;
}

export class ImageUploadService {
  /**
   * 上传图片到服务器
   * @param file 要上传的文件
   * @param systemName 可选的系统名称
   * @returns 返回上传后的文件信息
   */
  async uploadImage(file: File, systemName?: string): Promise<UploadedFile> {
    if (!file) {
      throw new Error('请先选择文件');
    }

    const formData = new FormData();
    formData.append('file', file);

    // 构建API URL，添加系统名称参数
    let apiUrl = '/api/image';
    if (systemName) {
      const safeSystemName = systemName.replace(/[^a-zA-Z0-9-_]/g, ''); // 移除不安全字符
      apiUrl += `?systemName=${encodeURIComponent(safeSystemName)}`;
    }

    // 调用API上传图片
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || '上传失败');
    }

    // 返回上传后的文件信息
    return {
      id: result.file.id,
      name: result.file.name,
      url: result.file.url,
      uploadTime: new Date(),
      selected: true,
      provider: result.file.provider
    };
  }

  /**
   * 从服务器删除图片
   * @param fileId 图片ID
   * @returns 删除操作的结果
   */
  async deleteImage(fileId: string): Promise<{success: boolean, message: string}> {
    // 调用API删除OSS中的图片
    const response = await fetch(`/api/image?key=${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '删除失败');
    }
    
    return {
      success: true,
      message: '文件删除成功'
    };
  }

  /**
   * 保存上传文件列表到本地存储
   * @param files 上传文件列表
   */
  saveUploadedFilesToStorage(files: UploadedFile[]): void {
    if (files.length > 0) {
      localStorage.setItem('uploaded-image-files', JSON.stringify(files));
    }
  }

  /**
   * 从本地存储加载上传文件列表
   * @returns 上传文件列表
   */
  loadUploadedFilesFromStorage(): UploadedFile[] {
    const storedFiles = localStorage.getItem('uploaded-image-files');
    if (!storedFiles) {
      return [];
    }
    
    try {
      const parsedFiles = JSON.parse(storedFiles);
      // 将字符串日期转换回Date对象
      return parsedFiles.map((file: any) => ({
        ...file,
        uploadTime: new Date(file.uploadTime),
        selected: parsedFiles.length === 1 ? true : false, // 只有一个文件时默认选中
        provider: file.provider || 'openai', // 记录文件提供者
        url: file.url // OSS URL
      }));
    } catch (e) {
      console.error('解析已上传文件列表失败:', e);
      return [];
    }
  }
} 