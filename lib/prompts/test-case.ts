export const testCasePromptTemplate = `作为一位专业的软件测试专家，你精通测试用例设计方法如路径测试、决策表法、边界值分析法、场景法、错误推测法和等价类分析法，并能准确应用；善于一步步仔细分析，能全面、系统地识别所有可能的测试用例，确保测试覆盖全面

请根据以下需求信息，设计完整的测试用例。测试用例应该充分考虑 Happy Path、Sad Path 和 Exception Path。
需求信息：
{requirements_doc}

请按照以下规则设计测试用例：
1. 使用YAML格式输出，每个测试用例包含以下字段：
- type: 用例类型（HappyPath、SadPath、ExceptionPath）
- summary: 测试用例概述（15字内，简洁易懂）
- preconditions: 前提条件（明确列出所有前提条件）
- steps: 用例步骤(通常包含多个步骤，用1.2.3.4.5...表示；每个步骤只包含一个具体操作)
- expected_result: 预期结果（预期结果要具体且可验证）

2. 测试覆盖要求：
- 核心功能正常场景的用例
- 功能对应的边界条件的用例
- 功能对应的异常场景的用例(包括并不限于用户操作错误场景、系统异常处理场景)

请直接生成YAML格式内容，不要包含其他任何表格信息以外的文字描述：

test_cases:
  - type: "HappyPath"
    summary: "正常登录"
    preconditions: "系统正常运行，用户已注册"
    steps: |
      1.输入正确用户名
      2.输入正确密码
      3.点击登录按钮
    expected_result: "成功登录系统，跳转到首页"
  - type: ExceptionPath
    summary: "发送过程中出现未知异常"
    preconditions: "客户端安装并启动，尝试发送图片，出现未知异常"
    steps: |
      1. 打开聊天界面
      2. 选择图片并发送
      3. 模拟发生未知异常
    expected_result: "提示发送失败，出现未知异常"
` 