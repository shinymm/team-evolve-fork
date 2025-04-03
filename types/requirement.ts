export interface Scene {
  name: string;
  content: string;
}

export interface RequirementContent {
  reqBackground: string;
  reqBrief: string;
  scenes: Scene[];
} 