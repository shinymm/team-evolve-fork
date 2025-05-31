# 国际化翻译文件

本项目使用 Next.js 和 next-intl 进行国际化（i18n）处理。翻译文件按照命名空间（namespaces）组织，使管理和维护更加方便。

## 文件结构

```
messages/
├── en/                  # 英文翻译文件目录
│   ├── common.json      # 通用翻译
│   ├── knowledge.json   # 知识管理相关翻译（包含系统架构、API接口、术语和边界识别等）
│   ├── layout.json      # 布局相关翻译
│   ├── pages.json       # 其他页面翻译
│   ├── requirement.json # 需求相关翻译（包含Book和User相关内容）
│   ├── special-capability.json # 特殊能力相关翻译（图片处理、提示词调试、需求上传等）
│   ├── system.json      # 系统相关翻译
│   ├── ai-team-factory.json      # AI团队工厂相关翻译
│   └── test.json        # 测试相关翻译
├── zh/                  # 中文翻译文件目录 (结构与英文相同)
│   └── ...
```

## 使用方法

在组件中使用翻译：

```tsx
import { useTranslations } from 'next-intl'

export default function MyComponent() {
  // 使用命名空间访问翻译
  const t = useTranslations('RequirementSummaryPage')
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      {/* ... */}
    </div>
  )
}
```

### 特殊能力页面的国际化

特殊能力页面（如图片处理、提示词调试和需求上传）的翻译存放在 `special-capability.json` 文件中，使用方法如下：

```tsx
import { useTranslations } from 'next-intl'

export default function ImageProcessingPage() {
  // 使用特殊能力命名空间访问翻译
  const t = useTranslations('ImageProcessingPage')
  
  return (
    <div>
      <h1>{t('title')}</h1>
      {/* ... */}
    </div>
  )
}
```

可用的特殊能力页面命名空间包括：
- `ImageProcessingPage`: 图片处理页面
- `PromptDebugPage`: 提示词调试页面
- `RequirementUploadPage`: 需求上传页面

## 添加新翻译

要添加新的翻译，请在适当的命名空间文件中添加，例如：

1. 打开对应的命名空间文件（如 `messages/en/requirement.json` 和 `messages/zh/requirement.json`）
2. 添加新的翻译键值对
3. 在组件中使用 `useTranslations` 钩子访问这些翻译

## 添加新的命名空间

如果需要创建新的命名空间：

1. 在 `messages/en/` 和 `messages/zh/` 目录下创建新的 JSON 文件
2. 在 JSON 文件中使用合适的命名空间名称作为顶级键
3. 在组件中使用 `useTranslations('NewNamespace')` 访问这个命名空间

## 翻译文件拆分工具

项目提供了一个脚本用于拆分大型翻译文件：

```bash
node scripts/split-translations.js
```

这个脚本会将 `messages/en.json` 和 `messages/zh.json` 按命名空间拆分到对应的目录中。

## 文件合并记录

- **2023-05-30**: `book.json` 内容已合并到 `requirement.json` 中，相关页面组件使用 `RequirementBookPage`、`RequirementEvolutionPage`、`BookConfirmPage` 和 `BookWritingPage` 命名空间即可访问翻译内容。
- **2023-05-30**: `user.json` 内容已合并到 `requirement.json` 中，相关页面组件使用 `UserStoryPage` 命名空间即可访问翻译内容。
- **2023-06-15**: `boundary.json` 内容已合并到 `knowledge.json` 中，相关组件使用 `BoundaryRules` 和 `BoundaryRuleDialog` 命名空间即可访问翻译内容。
- **2023-06-15**: 创建了 `special-capability.json` 文件，包含 `ImageProcessingPage`、`PromptDebugPage` 和 `RequirementUploadPage` 命名空间，用于特殊能力页面组件的国际化支持。 