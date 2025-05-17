export const CHAT_PROMPT = `
请基于以下产品知识，回答用户关于选中文本的问题。
充分利用产品知识，使回答更加准确和有针对性。

系统概述（电梯演讲）：
{productOverview}

用户画像信息：
{userPersonas}

信息架构：
{architectureInfo}

选中的文本内容：
{selectedText}

用户的问题/指令：
{instruction}

请提供专业、准确、符合产品背景的回复：
`; 