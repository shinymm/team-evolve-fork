# 图片存储系统设计文档

## 系统概述

图片存储系统负责管理上传到应用的图片文件，包括存储、检索和删除功能。系统采用分层设计，结合阿里云OSS、PostgreSQL数据库和Redis缓存，实现高效且可靠的图片存储和检索功能。

## 存储结构

### 文件存储 (阿里云OSS)

- 图片文件存储在阿里云OSS中
- 存储路径: `images/{系统名称}/{UUID}.{扩展名}`
- 每个系统的图片存放在独立的OSS目录中，确保隔离性

### 元数据存储 (PostgreSQL)

- 图片元数据存储在`UploadedImage`表中
- 每条记录包含图片的基本信息、所属系统ID、OSS路径等信息
- 表结构:
  ```sql
  CREATE TABLE "UploadedImage" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ossKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'aliyun-oss',
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    PRIMARY KEY ("id")
  );
  ```

### 缓存层 (Redis)

- 使用Redis缓存图片列表，减轻数据库查询压力
- 缓存键格式: `img:list:{systemId}`
- 缓存过期时间: 24小时

## 服务组件

### 1. 图片上传服务 (`ImageUploadService`)

- 负责处理图片上传、删除和获取功能
- 主要方法:
  - `uploadImage`: 上传图片到OSS并保存元数据到数据库
  - `deleteImage`: 从OSS和数据库中删除图片
  - `getImagesBySystemId`: 获取指定系统的图片列表
  - `updateImagesSelectedState`: 更新图片选中状态（仅缓存中）

### 2. API路由 (`/api/image`)

- 处理图片上传和删除的HTTP请求
- 支持的HTTP方法:
  - `POST`: 上传图片
  - `DELETE`: 删除图片

### 3. Redis工具 (`lib/redis.ts`)

- 提供Redis缓存操作的统一接口
- 支持设置、获取和删除缓存
- 使用连接池优化性能
- 提供JSON对象缓存支持

## 数据流程

1. **上传流程**:
   - 前端提交图片文件和系统ID
   - 服务调用OSS上传图片
   - 将元数据保存到数据库
   - 清除相关Redis缓存

2. **查询流程**:
   - 先检查Redis缓存
   - 若缓存存在，返回缓存数据
   - 若缓存不存在，从数据库查询并更新缓存

3. **删除流程**:
   - 从OSS删除图片文件
   - 从数据库删除元数据记录
   - 清除相关Redis缓存

## 配置要求

需要在环境变量中配置以下信息:

1. **OSS配置**:
   ```env
   OSS_REGION="ap-southeast-1"
   OSS_ACCESS_KEY_ID="your_access_key_id"
   OSS_ACCESS_KEY_SECRET="your_access_key_secret" 
   OSS_BUCKET="your_bucket_name"
   ```

2. **Redis配置**:
   ```env
   REDIS_URL="redis://:password@host:port"
   ```

## 使用示例

```typescript
// 初始化服务
const imageService = new ImageUploadService();

// 上传图片
const uploadedFile = await imageService.uploadImage(
  fileObject, 
  systemId,
  "username"
);

// 获取系统图片列表
const images = await imageService.getImagesBySystemId(systemId);

// 删除图片
await imageService.deleteImage(imageId, systemId);
```

## 注意事项

1. 确保数据库和Redis服务正常运行
2. 在首次部署时需要执行数据库迁移
3. 定期检查OSS存储空间是否充足
4. 考虑定期清理未关联到系统的孤立图片文件 