export const EXCEPTION_ANALYSIS_TEMPLATE = `请作为一个专业的软件开发工程师，分析以下异常信息并提供专业的诊断和建议：

异常发生的请求路径：{{request}}
异常信息：{{error}}
异常堆栈：
{{stackTrace}}

请从以下几个方面进行分析：
1. 异常原因：简要说明这个异常的直接原因
2. 可能的触发场景：描述可能导致这个异常的业务场景或操作
3. 潜在的代码问题：基于堆栈信息，指出可能存在问题的代码位置和原因
4. 修复建议：提供具体的修复方向和最佳实践建议
5. 预防措施：建议如何在代码层面预防此类异常再次发生

请用专业的技术语言进行分析，但要确保解释清晰易懂。`

export const getExceptionAnalysisPrompt = (exception: {
  request: string
  error: string
  stackTrace: string[]
}) => {
  return EXCEPTION_ANALYSIS_TEMPLATE
    .replace('{{request}}', exception.request)
    .replace('{{error}}', exception.error)
    .replace('{{stackTrace}}', exception.stackTrace.join('\n'))
} 