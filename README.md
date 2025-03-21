# qare-team-ai

## 技术备忘录

### 弹窗滚动实现

在处理大型弹窗（Dialog）中的内容滚动时，最佳实践是：

```jsx
<Dialog>
  <DialogContent className="w-[80vw] h-[85vh] p-0">
    <div className="h-full flex flex-col">
      {/* 1. 固定头部 */}
      <div className="flex-none">
        {/* 头部内容 */}
      </div>
      
      {/* 2. 滚动内容区域 */}
      <div className="absolute inset-x-0 bottom-0 top-[200px] overflow-y-auto">
        <div className="p-6">
          {/* 实际内容 */}
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

关键点：
1. 弹窗容器：
   - 使用固定的视窗比例尺寸（如：`w-[80vw] h-[85vh]`）
   - 移除默认内边距 `p-0`

2. 头部区域：
   - 使用 `flex-none` 确保高度不被压缩
   - 可以包含多个信息区块

3. 滚动区域：
   - 使用绝对定位 `absolute`
   - 通过 `inset-x-0 bottom-0 top-[200px]` 精确控制位置
   - 设置 `overflow-y-auto` 启用滚动

4. 内容区域：
   - 使用 padding 控制内容边距
   - 避免不必要的容器嵌套

这种实现方式的优势：
- 布局稳定，不依赖复杂的 flex 计算
- 滚动行为可预测
- 适用于动态内容
- 头部固定不动
- 内容区域可以平滑滚动

注意：`top-[200px]` 的值需要根据实际头部高度调整。

### AI 配置获取最佳实践

统一使用 `getAIConfig()` 获取默认大模型配置：

```typescript
// 1. 组件中使用
const [aiConfig, setAiConfig] = useState<AIModelConfig | null>(null)
useEffect(() => {
  setAiConfig(getAIConfig())
}, [])

// 2. 服务中使用
const aiConfig = getAIConfig()
if (!aiConfig) {
  throw new Error('未配置AI模型')
}
```

配置项结构：
```typescript
interface AIModelConfig {
  model: string        // 模型名称
  apiKey: string      // API密钥
  baseUrl: string     // API基础URL
  temperature?: number // 温度参数
}
```

注意事项：
1. 配置存储在 localStorage 的 `ai-model-configs` 中
2. 使用前需检查配置是否存在
3. 配置获取失败时需给出友好提示
4. 建议在组件初始化时获取配置并保存到状态中

预设配置：
- 智谱：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
- OpenAI：`https://api.openai.com/v1`

### Prompt 模板管理最佳实践

目录结构（示例）：
```
lib/
  ├── prompts/
  │   ├── exception-analysis.ts    // 异常分析模板
  └── services/
      ├── exception-analysis-service.ts
```

1. 模板定义（`lib/prompts/xxx.ts`）：
```typescript
export const TEMPLATE_NAME = `
请分析以下内容：

背景：{{background}}
需求：{{requirement}}
约束：{{constraints}}

分析要点：
1. xxx
2. xxx
`
```

2. 服务调用（`lib/services/xxx-service.ts`）：
```typescript
export class AnalysisService {
  async analyze(params: AnalysisParams) {
    const prompt = TEMPLATE_NAME
      .replace('{{background}}', params.background)
      .replace('{{requirement}}', params.requirement)
      .replace('{{constraints}}', params.constraints)

    const aiConfig = getAIConfig()
    if (!aiConfig) throw new Error('未配置AI模型')

    return streamingAICall(prompt, aiConfig, onContent)
  }
}
```

注意事项：
1. 模板使用 `{{变量名}}` 作为占位符
2. 所有 Prompt 模板统一放在 `/lib/prompts` 目录下
3. 模板替换逻辑统一在对应的 Service 中处理
4. Service 负责组装参数、调用 AI 接口并处理响应
