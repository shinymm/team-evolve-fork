export const highLevelArchitecture = `
@startuml High Level Architecture
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(user, "用户")
Boundary(c1, "系统") {
    System(system, "系统名称", "在这里描述系统的主要功能")
}
System_Ext(external1, "外部系统1", "描述与外部系统1的交互")
System_Ext(external2, "外部系统2", "描述与外部系统2的交互")

Rel(user, system, "使用")
Rel(system, external1, "调用")
Rel(system, external2, "调用")

@enduml
`; 