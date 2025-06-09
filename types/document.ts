import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  file_url: z.string(),
  object_key: z.string(),
  content_type: z.string(),
  status: z.enum(['uploaded', 'analyzing', 'reviewing', 'completed']),
  progress: z.number().min(0).max(100),
  issues: z.number().min(0),
  fixed: z.number().min(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;

export interface FileListResponse {
  total: number;
  skip: number;
  limit: number;
  files: {
    id: number;
    filename: string;
    file_url: string;
    content_type: string;
    created_at: string;
  }[];
}

export interface UploadResponse {
  success: boolean;
  file_url: string;
  object_key: string;
  filename: string;
  file_id: number;
  created_at: string;
  message?: string;
}

export interface UploadError {
  message: string;
  code: string;
}

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
}

export interface AssessmentRule {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: "high" | "medium" | "low";
  enabled: boolean;
}

export interface AnalysisStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "completed" | "skipped";
  progress: number;
}

export interface IntegrityResult {
  title: string;
  result: string;
  question: string;
  section_title?: string;
}

export interface ReviewIssue {
  id: string;
  type: "error" | "warning" | "suggestion";
  title: string;
  description: string;
  section: string;
  sectionTitle: string;
  suggestion: string;
}