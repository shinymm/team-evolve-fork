export const boundaryAnalysisPrompt = (
  requirementDoc: string,
  requirementSummary: string,
  requirementGlossary: string
) => `目前在进行撰写和优化需求文档A

目标需要处理的需求文档的内容（markdown格式）如下:
${requirementDoc}

需求文档A相关的文档摘要如下（json格式，一行一个文档摘要）
${requirementSummary}

需求文档A相关的术语如下（json格式，一行一个术语）：
${requirementGlossary}

根据你的经验，进行框架生成、内容补充、边界识别、激发创意，提出建议优化` 