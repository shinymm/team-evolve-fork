export const deploymentArchitecture = `
@startuml Deployment Architecture
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

AddElementTag("k8s", $bgColor="#4d4d4d", $fontColor="#ffffff")
AddElementTag("physical", $bgColor="#8c510a", $fontColor="#ffffff")
AddElementTag("paas", $bgColor="#1b7837", $fontColor="#ffffff")
AddElementTag("db", $bgColor="#00264a", $borderColor="#ffffff")

Boundary(externalDMZ,"External DMZ"){
System(fe2, "qare-ics-vue", "Vue", $descr="")
}

Boundary(iDMZ,"DMZ"){


System_Boundary(center1, "Center 1") {
    Container(k8s_cluster1, "Kubernetes Cluster", "Docker", $tags="k8s") {
        Container(pre1, "PRE前置", "Java8/SpringCloud", $descr="")
        Container(dashboard1, "Dashboard", "", $descr="")
        Container(robot1, "Robot", "", $descr="")
        Container(kb1, "knowledge", "", $descr="")
        Container(search1, "search", "", $descr="")
        Container(platform1, "Platform", "", $descr="")
        Container(ude1, "UDE", "", $descr="")
        Container(outcall1, "OutCall", "", $descr="")
        Container(opt1, "opt", "", $descr="")
        Container(process1, "Process", "", $descr="")
    }
    ContainerDb(mysql_master, "MySQL", "主数据库", $tags="db")
    ContainerDb(mysql_slave1, "MySQL", "从数据库", $tags="db")
}

System_Boundary(center2, "Center 2") {
    Container(k8s_cluster2, "Kubernetes Cluster", "Docker", $tags="k8s") {
        Container(pre2, "PRE 前置", "", $descr="")
        Container(dashboard2, "Dashboard", "", $descr="")
        Container(robot2, "Robot", "", $descr="")
        Container(kb2, "knowledge", "", $descr="")
        Container(search2, "search", "", $descr="")
        Container(platform2, "Platform", "", $descr="")
        Container(ude2, "UDE", "", $descr="")
        Container(outcall2, "OutCall", "", $descr="")
        Container(opt2, "opt", "", $descr="")
        Container(process2, "Process", "", $descr="")
    }
    ContainerDb(mysql_slave2, "MySQL", "从数据库", $tags="db")
}

System_Boundary(physical_machines, "Physical Machines") {
    Container(offline, "offline", "", $descr="", $tags="physical")
    Container(online, "Online", "", $descr="", $tags="physical")
}

System_Boundary(paas_services, "PaaS Services") {
    Container(es, "ES", "Elasticsearch", $descr="会话记录", $tags="paas")
    Container(kafka, "Kafka", "Kafka", $descr="消息队列", $tags="paas")
    Container(api_gateway, "API Gateway", "SpringCloud", $descr="API网关", $tags="paas")
}

Rel(mysql_master, mysql_slave1, "主从同步", "MySQL Binlog")
Rel(mysql_master, mysql_slave2, "主从同步", "MySQL Binlog")

Rel(k8s_cluster1, mysql_master, "数据库访问", "JDBC")
Rel(k8s_cluster2, mysql_master, "数据库访问", "JDBC")

Rel(api_gateway,k8s_cluster1,  "API调用", "HTTPS")
Rel(api_gateway,k8s_cluster2, "API调用", "HTTPS")

Rel_D(fe2,api_gateway, "前端访问", "HTTPS")

Rel_D(k8s_cluster1,physical_machines, "模型训练/模型推理", "Kafka/HTTPS")
Rel_D(k8s_cluster2,physical_machines, "模型训练/模型推理", "Kafka/HTTPS")

}
@enduml
`; 