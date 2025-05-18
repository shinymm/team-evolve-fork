// 自定义视觉分析提示词模板
export const customVisionAnalysisPrompt = `根据提供的图片内容，结合用户提示词进行分析。

<Rules>
1. 认真观察图片细节，尽可能提供全面的分析
2. 根据用户提示词的具体要求进行有针对性的分析
3. 用markdown格式组织输出，使用标题、列表等结构化呈现
4. 输出语言与图片中的主要文字语言保持一致
5. 对不确定内容明确标注"(待确认)"
</Rules>

<SystemInfo>
系统名称：{{SYSTEM_NAME}}
系统描述：{{SYSTEM_DESCRIPTION}}
</SystemInfo>

<UserPrompt>
{{CUSTOM_PROMPT}}
</UserPrompt>
`;

// 系统角色提示模板
export const systemRoleTemplate = `你是一个视觉分析专家，请根据用户的提示词分析图片内容并提供详细信息。`; 