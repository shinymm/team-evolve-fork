export const generateSummaryPromptTemplate = `作为一位专业的测试专家，请基于以下测试用例细节，生成一个简洁而准确的用例概述。

前提条件：
{preconditions}

测试步骤：
{steps}

预期结果：
{expected_result}

请分析上述内容，生成一个能够概括测试要点的用例概述（15字以内）。

请使用JSON格式返回，包含以下字段：
- summary: 用例概述

示例输出：
{
  "summary": "验证知识库意图创建功能"
}
` 