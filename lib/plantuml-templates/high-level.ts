export const highLevelArchitecture = `
@startuml Basic Sample
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

!$COLOR_NEUTRAL = "#f7f7f7"
!$COLOR_B_2 = "#91BAE1"
!$COLOR_B_4 = "#91BAEA"
UpdateElementStyle("external_system", $bgColor=$COLOR_B_2, $fontColor="black", $borderColor=$COLOR_B_2, $legendText="CoreSystem")


Person_Ext(user, "零售客户", $sprite="person")
Person_Ext(buser, "对公机构客户", $sprite="person")
Person(mgr, "零售客户经理", $sprite="person2")
Person(oper, "坐席", $sprite="person2")
Person(bmgr, "对公客户经理", $sprite="person2")
Person(trader, "金市交易员/同业", $sprite="person2")
Person(internal, "内部员工", $sprite="person2")
Person(caiwu, "财务", $sprite="person2")
Person(c, "柜员", $sprite="person2")
Person(branch_user, "分行员工", $sprite="person2")
Person(jituan_user, "集团用户", $sprite="person2")

Boundary(c1, "智能对话", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System(qare, "智能对话系统", "", $descr="智能外呼、文本/语音机器人、会话质检、知识运营、机器人引擎运营")
}
Boundary(c2, "零售", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(95558, "语音客服", $descr="纯机外呼/人机协呼")
    System_Ext(ivr, "IVR", $descr="智能语音导航")
    System_Ext(m, "队伍工作台", $descr="零售客户经理")
    System_Ext(mobile, "手机银行", $descr="AI管家、财富顾问")
    System_Ext(opr, "坐席系统", $descr="坐席辅助")
}

Boundary(c3, "金融市场", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(trade, "同业", $descr="金市交易平台")
}
Boundary(c4, "对公", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(corpweb, "对公网银/APP", $descr="对公服务入口")
    System_Ext(mpp, "队伍工作台", $descr="对公贷款问答等")
}
Boundary(c5, "内部运营/管理决策", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(operate, "运维", $descr="内部运维知识")
    System_Ext(money, "报销问答", $descr="财务相关")
    System_Ext(counter, "柜面系统", $descr="柜面知识")
}
Boundary(c6, "集团", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(jituan, "协同机器人", $descr="集团知识")
}
Boundary(c7, "分行", $link="https://github.com/plantuml-stdlib/C4-PlantUML") {
    System_Ext(branch, "各个分行", $descr="运维/营销知识等机器人")
}

System_Ext(knowledge, "知识库", $descr="FAQ知识管理源头")
System_Ext(graph, "图谱", $descr="图谱知识源头")
System_Ext(sea, "其他三方服务", $descr="如三方模型")

Rel(95558,user, "", "语音外呼")
Rel(user, 95558, "", "语音进线")
Rel(user, mobile, "", "语音/文本")

Rel(branch_user, branch, "", "语音/文本")
Rel(jituan_user, jituan, "", "语音/文本")

Rel(trader, trade, "", "语音/文本")

Rel(oper, opr, "", "语音/文本")

Rel(internal, operate, "", "语音/文本")
Rel(caiwu, money, "", "语音/文本")
Rel(c, counter, "", "语音/文本")

Rel(buser, corpweb, "", "语音/文本")
Rel(bmgr, mpp, "", "语音/文本")

Rel(mpp, qare, "")
Rel(opr, qare, "")

Rel(operate, qare, "")
Rel(money, qare, "")
Rel(counter, qare, "")

Rel(branch, qare, "")
Rel(jituan, qare, "")

Rel(qare, 95558, "")
Rel(95558, qare, "")
Rel(mobile, qare, "")
Rel(trade, qare, "交易信息抽取")
Rel(m, qare,"发起协呼任务")
Rel(mgr,m,"", "语音/文本")
Rel(qare, ivr, "")
Rel(ivr, qare, "", "端内语音")
Rel_D(95558, ivr, "")
Rel(ivr, 95558, "")

Rel_U(knowledge, qare, "Kaffka",$tags="backup")
Rel_U(graph, qare, "每日同步",$tags="backup")
Rel_D(qare, sea, "剧本服务节点调用",$tags="backup")

@enduml
`; 