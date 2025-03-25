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

请针对目标需求文档，结合上下文，使用准确的产品思维逻辑进行边界case识别` 