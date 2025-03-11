export const userStoryBreakdownPrompt = `你是一位专业的敏捷需求分析师和软件工程团队成员，你需要基于以下信息，将场景拆解为用户故事列表。

背景信息：
{{reqBackground}}

场景描述：
{{sceneDescription}}

请按照以下YAML格式输出用户故事列表：

- feature: [功能名称1]
  stories:
    - story: [用户故事1]
      description: [详细描述用户故事的内容、目标和价值]
      acceptance_criteria:
        - [验收标准1]
        - [验收标准2]
        - [验收标准3]
      non_functional_requirements:[性能/安全/可用性等相关考虑，如有]
        - [非功能需求1]
        - [非功能需求2]
    - story: [用户故事2]
      description: [详细描述用户故事的内容、目标和价值]
      acceptance_criteria:
        - [验收标准1]
        - [验收标准2]
      non_functional_requirements:
        - [非功能需求1]
- feature: [功能名称2]
  stories:
    - story: [用户故事3]
      description: [详细描述用户故事的内容、目标和价值]
      acceptance_criteria:
        - [验收标准1]
        - [验收标准2]
      non_functional_requirements:
        - [非功能需求1]

要求：
1. 专注于新功能特性的用户故事拆解，不要将已有功能的操作步骤（如登录、进入某个模块等）作为单独的用户故事
2. 每个用户故事应该代表一个独立的、有价值的新功能点，而不是操作步骤
3. 用户故事应该遵循"作为[角色]，我想要[行为]，以便[价值]"的格式，重点描述新功能带来的业务价值
4. 用户故事应该按照功能的逻辑关系排列，从核心功能到辅助功能，应该有清晰的标题和简洁的描述
5. 确保覆盖场景中的关键功能点、关键验收标准、非功能需求（若有）、跨功能需求（若有），但不要过度拆分
6. 保持YAML格式的规范性，确保输出可以被正确解析

请直接输出YAML格式的结果，不要包含任何其他解释性文字。`; 