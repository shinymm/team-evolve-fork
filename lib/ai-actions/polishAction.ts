import { PromptAction, FacetType, OutputForm, ChangeForm, DefinedVariable } from '@studio-b3/web-core';

/**
 * 定义用于 Studio B3 MenuBubble 的 PromptAction 对象 (使用 template)
 */
export const polishBubbleAction: PromptAction = {
  name: "润色（new）", 
  i18Name: false, 
  // 使用 template 定义提示，包含字面量 ${selection}
  template: `请润色并重写如下的内容：###\${selection}###`, 
  facetType: FacetType.BUBBLE_MENU,
  outputForm: OutputForm.TEXT, // 保持 TEXT 与后端 API 匹配
  changeForm: ChangeForm.INSERT,
  // 没有 action 属性
}; 