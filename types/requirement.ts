export interface Scene {
  name: string
  overview: string
  userJourney: string[]
}

export interface RequirementContent {
  reqBackground: string
  reqBrief: string
  scenes: Scene[]
} 