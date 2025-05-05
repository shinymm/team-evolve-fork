export interface Scene {
  name: string;
  content: string;
}

export interface RequirementContent {
  contentBeforeScenes: string;
  scenes: Scene[];
  contentAfterScenes: string;
} 