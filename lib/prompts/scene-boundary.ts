interface SceneBoundaryPromptParams {
  reqBackground: string;
  reqBrief: string;
  sceneName: string;
  sceneContent: string;
  boundaryRules: string[];
}

export function sceneBoundaryPromptTemplate(params: SceneBoundaryPromptParams): string {
  return `基于以下信息，分析场景的边界条件：

需求背景：
${params.reqBackground}

需求概述：
${params.reqBrief}

场景名称：${params.sceneName}

场景内容：
${params.sceneContent}

边界规则：
${params.boundaryRules.join('\n')}

请针对场景需求片段<场景内容>进行边界分析：
- 参考<边界规则>使用准确的产品思维逻辑进行边界case识别（只分析片段中的内容），要从产品经理的视角出发：
    * 注意重点检视和澄清功能及业务规则的边界场景，通过明确需求中的模糊术语、完善规则条件及其组合、检查数值与范围的边界情况，以及验证时间与顺序依赖的各类边界场景，确保需求全面、无歧义且符合预期。
    * 技术实现层面的边界问题先不深入分析讨论，**不用关注如**通用的交互操作case，如"用户连续点击多次XX"、"网络断开时点击XX"、"重复多次点击XX”、服务中断、资源不足、极端并发等情况下的Case

输出时候，只需要输出针对场景需求片段<场景内容>的边界Case，最好呈现方式能便于产品经理跟原始需求片段<场景内容>一一对应印证的

如：
#### XXX (同<场景内容>中的功能标题，层次与描述与<场景内容>保持一致）
  1. XXX (同<场景内容>中的小标题，层次与<场景内容>保持一致）
    - XXX (正常操作下的预期结果，层次与内容与<场景内容>保持一致）
    - **⚠️ 边界Case**：补充Case简述XXXX (30字内的边界Case简述)

请开始分析：`
} 