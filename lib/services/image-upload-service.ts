/**
 * 图片上传服务
 * 负责处理图片上传、删除等功能
 */

import { prisma } from '@/lib/prisma'; 
import { setJsonCache, getJsonCache, deleteCache, CACHE_KEYS, CACHE_EXPIRE } from '@/lib/redis';

// 定义图片数据库模型的接口
interface DBUploadedImage {
  id: string;
  systemId: string;
  name: string;
  ossKey: string;
  url: string;
  provider: string;
  fileSize: number | null;
  fileType: string | null;
  uploadTime: Date;
  createdBy: string | null;
}

export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  uploadTime: Date;
  selected?: boolean;
  provider: string;
  fileSize?: number;
  fileType?: string;
}

export class ImageUploadService {
  /**
   * 上传图片到服务器
   * @param file 要上传的文件
   * @param systemId 系统ID
   * @param userName 上传者用户名（可选）
   * @returns 返回上传后的文件信息
   */
  async uploadImage(file: File, systemId: string, userName?: string): Promise<UploadedFile> {
    if (!file) {
      throw new Error('请先选择文件');
    }

    if (!systemId) {
      throw new Error('系统ID不能为空');
    }

    console.log(`【图片上传】开始上传图片 - 系统ID: ${systemId}, 文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(2)}KB`);

    // 验证系统ID是否有效
    try {
      console.log(`【图片上传】验证系统ID: ${systemId}`);
      const system = await prisma.system.findUnique({
        where: { id: systemId },
        select: { id: true, name: true }
      });

      if (!system) {
        throw new Error(`系统ID无效: ${systemId}`);
      }
      
      console.log(`【图片上传】系统验证通过 - ID: ${systemId}, 名称: ${system.name}`);
      
      const formData = new FormData();
      formData.append('file', file);

      // 构建API URL，添加系统名称参数
      let apiUrl = '/api/image';
      const safeSystemName = system.name.replace(/[^a-zA-Z0-9-_]/g, '');
      apiUrl += `?systemName=${encodeURIComponent(safeSystemName)}`;

      console.log(`【图片上传】调用API上传图片: ${apiUrl}`);
      
      // 调用API上传图片
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        console.error(`【图片上传】API返回错误: ${response.status} ${response.statusText}`, result);
        throw new Error(result.error || '上传失败');
      }

      console.log(`【图片上传】OSS上传成功:`, result.file);

      try {
        // 准备插入数据
        const imageData = {
          systemId,
          name: result.file.name,
          ossKey: result.file.id,
          url: result.file.url,
          provider: result.file.provider,
          fileSize: result.file.size,
          fileType: result.file.type,
          createdBy: userName || 'unknown'
        };
        
        console.log(`【图片上传】准备保存元数据到数据库:`, imageData);
        
        // 使用原始SQL直接插入
        const uploadedImage = await prisma.$executeRaw`
          INSERT INTO "UploadedImage" (
            "id", "systemId", "name", "ossKey", "url", 
            "provider", "fileSize", "fileType", "uploadTime", "createdBy"
          )
          VALUES (
            gen_random_uuid(), ${imageData.systemId}, ${imageData.name}, 
            ${imageData.ossKey}, ${imageData.url}, ${imageData.provider}, 
            ${imageData.fileSize}, ${imageData.fileType}, NOW(), ${imageData.createdBy}
          )
        `;

        // 插入后查询获取刚插入的图片数据
        const insertedImage = await prisma.$queryRaw<DBUploadedImage[]>`
          SELECT * FROM "UploadedImage" 
          WHERE "ossKey" = ${imageData.ossKey}
          LIMIT 1
        `;

        const image = insertedImage[0];
        console.log(`【图片上传】元数据保存成功 - ossKey: ${image.ossKey}`);

        // 清除此系统的缓存
        await deleteCache(`${CACHE_KEYS.IMAGE_LIST}${systemId}`);
        console.log(`【图片上传】已清除缓存: ${CACHE_KEYS.IMAGE_LIST}${systemId}`);

        // 返回上传后的文件信息
        return {
          id: image.ossKey,
          name: image.name,
          url: image.url,
          uploadTime: image.uploadTime,
          selected: true,
          provider: image.provider,
          fileSize: image.fileSize || undefined,
          fileType: image.fileType || undefined
        };
      } catch (dbError) {
        console.error('【图片上传】保存图片元数据失败:', dbError);
        
        // 记录详细错误
        if (dbError instanceof Error) {
          console.error('【图片上传】错误详情:', {
            message: dbError.message,
            stack: dbError.stack,
            name: dbError.name
          });
        }
        
        // 尽管数据库存储失败，但文件已上传到OSS，所以我们仍然返回信息
        return {
          id: result.file.id,
          name: result.file.name,
          url: result.file.url,
          uploadTime: new Date(),
          selected: true,
          provider: result.file.provider,
          fileSize: result.file.size,
          fileType: result.file.type
        };
      }
    } catch (error) {
      console.error('【图片上传】处理失败:', error);
      throw error instanceof Error 
        ? error 
        : new Error(String(error));
    }
  }

  /**
   * 从服务器删除图片
   * @param fileId 图片ID（OSS Key）
   * @param systemId 系统ID
   * @returns 删除操作的结果
   */
  async deleteImage(fileId: string, systemId: string): Promise<{success: boolean, message: string}> {
    if (!fileId || !systemId) {
      throw new Error('图片ID和系统ID不能为空');
    }

    // 调用API删除OSS中的图片，确保传递systemId参数
    const response = await fetch(`/api/image?key=${encodeURIComponent(fileId)}&systemId=${encodeURIComponent(systemId)}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || '删除失败');
    }

    try {
      // 从数据库中删除图片记录
      await prisma.$executeRaw`DELETE FROM "UploadedImage" WHERE "ossKey" = ${fileId} AND "systemId" = ${systemId}`;

      // 清除此系统的缓存
      await deleteCache(`${CACHE_KEYS.IMAGE_LIST}${systemId}`);
    } catch (dbError) {
      console.error('从数据库删除图片记录失败:', dbError);
      // 尽管数据库删除失败，但文件已从OSS中删除，所以我们仍然返回成功
    }
    
    return {
      success: true,
      message: '文件删除成功'
    };
  }

  /**
   * 获取系统的图片列表
   * @param systemId 系统ID
   * @returns 图片列表
   */
  async getImagesBySystemId(systemId: string): Promise<UploadedFile[]> {
    if (!systemId) {
      return [];
    }

    // 尝试从Redis缓存获取
    const cachedImages = await getJsonCache<UploadedFile[]>(`${CACHE_KEYS.IMAGE_LIST}${systemId}`);
    if (cachedImages) {
      return cachedImages.map(img => ({
        ...img,
        uploadTime: new Date(img.uploadTime),
        selected: false
      }));
    }

    // 从数据库获取
    try {
      const images = await prisma.$queryRaw<DBUploadedImage[]>`
        SELECT * FROM "UploadedImage" 
        WHERE "systemId" = ${systemId}
        ORDER BY "uploadTime" DESC
      `;

      const formattedImages = images.map((img) => ({
        id: img.ossKey,
        name: img.name,
        url: img.url,
        uploadTime: img.uploadTime,
        selected: false,
        provider: img.provider,
        fileSize: img.fileSize || undefined,
        fileType: img.fileType || undefined
      }));

      // 保存到Redis缓存
      await setJsonCache(
        `${CACHE_KEYS.IMAGE_LIST}${systemId}`, 
        formattedImages, 
        CACHE_EXPIRE.ONE_DAY
      );

      return formattedImages;
    } catch (error) {
      console.error('获取图片列表失败:', error);
      return [];
    }
  }

  /**
   * 更新图片选中状态
   * @param images 更新后的图片列表
   * @param systemId 系统ID（用于更新缓存）
   */
  async updateImagesSelectedState(images: UploadedFile[], systemId: string): Promise<void> {
    // 只需更新Redis缓存，不需要更新数据库
    if (systemId) {
      await setJsonCache(
        `${CACHE_KEYS.IMAGE_LIST}${systemId}`, 
        images, 
        CACHE_EXPIRE.ONE_DAY
      );
    }
  }
} 