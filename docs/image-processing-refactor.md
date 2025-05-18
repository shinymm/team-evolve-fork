# 图片分析页面重构指南

## 重构目标

将复杂的 `app/special-capability/image-processing/page.tsx` 文件（近2000行代码）拆分为更小、更可维护的组件和服务。

## 已完成组件

### UI组件

1. **图片列表组件** (`components/image-processing/ImageList.tsx`)
   - 负责显示和管理已上传的图片列表
   - 支持折叠/展开、选择/取消选择功能

2. **内容显示组件** (`components/image-processing/ContentDisplay.tsx`)
   - 负责渲染Markdown格式的分析结果
   - 包含空内容的友好提示

3. **推理过程显示组件** (`components/image-processing/ReasoningDisplay.tsx`)
   - 显示AI模型的推理过程
   - 支持折叠/展开功能

4. **补充信息弹窗** (`components/image-processing/SupplementDialog.tsx`)
   - 用于输入分析前的补充信息

5. **上传对话框** (`components/image-processing/UploadDialog.tsx`)
   - 处理图片上传界面
   - 支持拖拽上传

### 服务和工具

1. **图片上传服务** (`lib/services/image-upload-service.ts`)
   - 处理图片上传和删除功能
   - 管理本地存储的图片列表

2. **文件导出工具** (`lib/utils/file-export.ts`)
   - 提供导出Markdown和JSON文件功能

3. **图片处理服务** (`lib/services/image-processing-service.ts`)
   - 整合各个分析服务，提供统一接口

4. **类型定义** (`types/image-processing.ts`)
   - 为页面组件提供类型定义

## 重构后的文件结构

```
app/
  └── special-capability/
      └── image-processing/
          └── page.tsx  # 重构后的主页面，更简洁清晰

components/
  └── image-processing/
      ├── ImageList.tsx            # 图片列表组件
      ├── ContentDisplay.tsx       # 内容显示组件
      ├── ReasoningDisplay.tsx     # 推理过程显示组件
      ├── SupplementDialog.tsx     # 补充信息弹窗
      └── UploadDialog.tsx         # 上传对话框

lib/
  ├── services/
  │   ├── image-upload-service.ts    # 图片上传服务
  │   └── image-processing-service.ts # 图片处理服务
  └── utils/
      └── file-export.ts             # 文件导出工具

types/
  └── image-processing.ts            # 类型定义
```

## 重构主页面指南

1. 导入新创建的组件和服务
2. 使用组件替换原来页面中的内联组件
3. 将业务逻辑委托给相应的服务
4. 使用类型定义规范状态和属性
5. 保留页面状态管理和事件处理逻辑

## 重构建议

1. 分阶段重构，每次处理页面的一部分
2. 先替换简单的UI组件，再处理业务逻辑
3. 使用服务实例化替代直接调用服务类的静态方法
4. 保持组件和服务的统一命名风格

## 注意事项

1. 确保在页面加载时正确初始化所有状态
2. 维护已有的用户体验和功能行为
3. 测试所有关键路径，确保功能无缺失
4. 删除原页面代码前做好备份 