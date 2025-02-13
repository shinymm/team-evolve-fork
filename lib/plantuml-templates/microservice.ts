export const microserviceArchitecture = `
@startuml Basic Sample
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

AddElementTag("out", $bgColor="#b35806")
AddElementTag("db", $bgColor="#00264a",$borderColor="#ffffff")
AddElementTag("gateway", $bgColor="#00264a",$borderColor="#ffffff")
AddRelTag("backup", $lineStyle = DashedLine())

System_Ext(upstream, "Upstream", $descr="零售、对公、金市等各上游系统")
Person(opsUser, "运营团队")

System_Boundary(c1, "智能对话系统") {
    Container(pre, "PRE 前置", "Java8/SpringCloud", $descr="协议转换、数据处理、会话")
    Container(fe, "qare-ics-vue", "Vue", $descr="运营门户")
    Container(gateway, "API Gateway", "SpringCloud", $descr="API网关",$tags="gateway")
    Container(robot, "Robot", "Java8/SpringCloud", $descr="会话时-机器人引擎与总控会话记录入es、运营时-机器人配置")
    Boundary(c2, "知识管理") {
        Container(kb, "knowledge", "Java8/SpringCloud", $descr="运营时-知识库/剧本/话术等配置、会话时-知识/剧本节点/话术匹配应答")
        Container(search, "search", "Java8/SpringCloud", $descr="文档知识检索")
        ContainerDb(embedding, "向量库", "milvus", $descr="文档向量化",$tags="db")
    }
    Container(platform, "Platform", "Java8/SpringCloud", $descr="用户权限等基础运营管理")
    Container(ude, "UDE", "Java8/SpringCloud", $descr="会话时-整体文本对话过程管理")
    Container(outcall, "OutCall", "Java8/SpringCloud", $descr="智能外呼核心中控")
    Container(outcall, "OutCall", "Java8/SpringCloud", $descr="智能外呼核心中控")
    Container(switch, "FreeSwitch", "中间件", $descr="软电话交换机",$tags="gateway")
    Container(opt, "opt", "Java8/SpringCloud", $descr="运营时数据标注、模型训练、发布")
    Boundary(c4, "数据处理") {
        Container(process, "Process", "Java8/SpringCloud", $descr="ES会话数据主备增量同步、离线数据处理（如预警监控等数据处理）")
    }
    Boundary(c3, "模型训推") {
        Container(offline, "offline", "Java/Python/TensorFlow", $descr="模型训练")
        Container(online, "Online", "Java/Python", $descr="推理服务、意图分类、实体识别、聚类、相似问推荐等")
        ContainerDb(obs, "OBS", "华为OBS", $descr="模型存储、训练数据集",$tags="db")
    }
    ContainerDb(es, "ES", "", $descr="会话记录",$tags="db")
}

System_Ext(knowledge, "知识库", $descr="FAQ知识管理源头")
System_Ext(graph, "图谱", $descr="图谱知识源头")

Rel_D(upstream, pre, "发起会话", "HTTPS")
Rel(pre, gateway, "会话信息", "HTTPS")
Rel_D(opsUser, fe, "日常运营", "HTTPS")
Rel(fe, gateway, "运营管理", "HTTPS")
Rel_U(outcall, switch,  "智能外呼", "HTTPS")
Rel_D(outcall, robot,  "智能外呼", "HTTPS")
Rel_U(switch, upstream,   "智能外呼", "HTTPS")

Rel(gateway, robot, "运营时配置机器人、会话时问答", "HTTPS")
Rel(gateway, kb, "", "HTTPS")

Rel(robot, ude, "会话问答", "HTTPS")
Rel(ude, kb, "意图列表查询/意图召回/实体查询", "HTTPS")
Rel(ude, search, "文档检索", "HTTPS")
Rel(search, embedding, "检索", "HTTPS")
Rel(ude, online, "NLU请求、意图识别等", "HTTPS")

Rel(process, es, "主备数据同步", "Kaffka", $tags="backup")
Rel(opt, es,  "获取会话标注", "Kaffka", $tags="backup")
Rel(opt,online, "模型发布", "https")
Rel(opt,process, "预警监控/测评巡检", "https")
Rel(opt,obs, "（发起训练时）转存训练数据集", "file", $tags="backup")
Rel_R(gateway, platform, "", "HTTPS")
Rel(gateway, opt, "运营管理", "HTTPS")
Rel(opt, offline, "发起训练任务", "HTTPS")
Rel(offline, obs, "模型存储", "", $tags="backup")
Rel(online, obs, "获取模型文件启动", "", $tags="backup")

Rel_U(graph, kb, "每日定时同步", "file", $tags="backup")
Rel_U(knowledge, kb, "", "Kaffka", $tags="backup")

@enduml
`; 