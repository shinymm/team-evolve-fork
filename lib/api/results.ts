import { ApiClient } from './client';
import { ApiResponse } from '@/types/api';

export interface ReviewRule {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  issueCount: number;
  fixedCount: number;
  progress: number;
  score: number;
}

export interface ReviewIssue {
  id: string;
  type: 'error' | 'warning' | 'suggestion';
  title: string;
  description: string;
  section: string;
  sectionTitle: string;
  suggestion: string;
  accepted?: boolean;
}

export interface DocumentComparison {
  sectionId: string;
  sectionTitle: string;
  originalContent: string;
  modifiedContent: string;
}

export interface ReportStats {
  solvedIssues: number;
  pendingIssues: number;
  documentQuality: number;
  firstConfirmationRate: number;
}

export interface RuleIssueMapping {
  ruleId: string;
  ruleName: string;
  issues: string[];
  suggestions: string[];
}

export class ResultsService {
  private static instance: ResultsService;
  private apiClient: ApiClient;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  static getInstance(): ResultsService {
    if (!ResultsService.instance) {
      ResultsService.instance = new ResultsService();
    }
    return ResultsService.instance;
  }

  async getReviewRules(): Promise<ApiResponse<ReviewRule[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [
        {
          id: 'rule1',
          name: '需求完整性检查',
          status: 'fail',
          issueCount: 4,
          fixedCount: 3,
          progress: 75,
          score: 75
        },
        {
          id: 'rule2',
          name: '需求一致性检查',
          status: 'fail',
          issueCount: 2,
          fixedCount: 1,
          progress: 50,
          score: 50
        },
        {
          id: 'rule3',
          name: '需求可测试性检查',
          status: 'pass',
          issueCount: 1,
          fixedCount: 1,
          progress: 100,
          score: 100
        },
        {
          id: 'rule4',
          name: '需求可追溯性检查',
          status: 'fail',
          issueCount: 1,
          fixedCount: 0,
          progress: 0,
          score: 0
        },
        {
          id: 'rule5',
          name: '需求明确性检查',
          status: 'pass',
          issueCount: 3,
          fixedCount: 3,
          progress: 100,
          score: 100
        }
      ],
      status: 'success',
      message: 'Review rules retrieved successfully'
    });
  }

  async getReviewIssues(): Promise<ApiResponse<ReviewIssue[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [
        {
          id: "rt1",
          type: "error",
          title: "缺少具体的性能指标",
          description: "当前PRD中对智能驾驶系统的性能指标描述不够具体，建议添加量化指标如响应时间、准确率等。",
          section: "section-3-2",
          sectionTitle: "3.2 系统性能要求",
          suggestion: "系统响应时间应不超过100ms，目标识别准确率应达到98%以上，系统稳定性应确保99.9%的可用性。",
          accepted: true
        },
        {
          id: "rt2",
          type: "warning",
          title: "用户场景描述不完整",
          description: "用户场景描述过于简略，缺少极端情况和边缘案例的考虑。",
          section: "section-2-2",
          sectionTitle: "2.2 用户调研",
          suggestion: "建议补充恶劣天气、复杂路况等边缘场景的处理方案。",
          accepted: false
        },
        {
          id: "rt3",
          type: "suggestion",
          title: "缺少合规性要求",
          description: "未明确提及智能驾驶相关的法规标准要求。",
          section: "section-4-1",
          sectionTitle: "4.1 法规要求",
          suggestion: "建议添加ISO 26262功能安全标准、国标等相关法规要求。",
          accepted: true
        }
      ],
      status: 'success',
      message: 'Review issues retrieved successfully'
    });
  }

  async getDocumentComparison(): Promise<ApiResponse<DocumentComparison[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [
        {
          sectionId: "section-3-2",
          sectionTitle: "3.2 系统性能要求",
          originalContent: "系统需要满足以下性能指标要求。",
          modifiedContent: "系统需要满足以下性能指标要求：\n1. 系统响应时间应不超过100ms\n2. 目标识别准确率应达到98%以上\n3. 系统稳定性应确保99.9%的可用性\n4. 峰值处理能力应支持每秒1000次请求"
        }
      ],
      status: 'success',
      message: 'Document comparison retrieved successfully'
    });
  }

  async getReportStats(): Promise<ApiResponse<ReportStats>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: {
        solvedIssues: 8,
        pendingIssues: 3,
        documentQuality: 95,
        firstConfirmationRate: 73
      },
      status: 'success',
      message: 'Report statistics retrieved successfully'
    });
  }

  async getRuleIssueMapping(): Promise<ApiResponse<RuleIssueMapping[]>> {
    // 临时返回模拟数据，后续会替换为实际的 API 调用
    return Promise.resolve({
      data: [
        {
          ruleId: "rule1",
          ruleName: "需求完整性检查",
          issues: [
            "用户场景描述不完整",
            "缺少合规性要求",
            "可靠性要求缺失",
            "安全要求不够全面"
          ],
          suggestions: [
            "补充边缘场景处理方案",
            "添加法规标准要求",
            "完善环境条件要求",
            "扩展安全性要求维度"
          ]
        },
        {
          ruleId: "rule5",
          ruleName: "需求明确性检查",
          issues: [
            "缺少具体性能指标",
            "自动泊车激活条件不明确",
            "用户界面交互细节不足"
          ],
          suggestions: [
            "添加量化指标",
            "明确激活条件和限制",
            "补充界面布局和交互细节"
          ]
        }
      ],
      status: 'success',
      message: 'Rule issue mapping retrieved successfully'
    });
  }
} 