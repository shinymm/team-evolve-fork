"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, MessageSquare, CheckCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ResultsService, ReviewRule, ReviewIssue, DocumentComparison } from "@/lib/api/results"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
console.log(BASE_URL);

interface ResultsTabProps {
  onNextStep: () => void;
  onBackToReview: () => void;
  fileId?: string | number;
  fileName?: string;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ onNextStep, onBackToReview, fileId, fileName }) => {
  const [uploadedDocuments, setUploadedDocuments] = useState([
    { title: "智能驾驶系统PRD", status: "reviewing" }
  ]);
  const [reviewRules, setReviewRules] = useState<ReviewRule[]>([]);
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparison[]>([]);
  const [assessmentResults, setAssessmentResults] = useState<any[]>([]);
  const [evaluationIssues, setEvaluationIssues] = useState<any[]>([]);

  useEffect(() => {
    const resultsService = ResultsService.getInstance();

    // Get review rules
    resultsService.getReviewRules().then(response => {
      if (response.status === 'success' && response.data) {
        setReviewRules(response.data);
      }
    });

    // Get review issues
    resultsService.getReviewIssues().then(response => {
      if (response.status === 'success' && response.data) {
        setReviewIssues(response.data);
      }
    });

    // Get document comparison
    resultsService.getDocumentComparison().then(response => {
      if (response.status === 'success' && response.data) {
        setDocumentComparison(response.data);
      }
    });

    if (!fileId) return;
    fetch(`${BASE_URL}/files/${fileId}/system-assessment`)
      .then(res => res.json())
      .then(data => setAssessmentResults(data || []));
    fetch(`${BASE_URL}/files/${fileId}/latest-evaluation`)
      .then(res => res.json())
      .then(data => {
        // 合并所有评审问题
        const issues = Array.isArray(data?.evaluations)
          ? data.evaluations.flatMap((ev: any) => Array.isArray(ev.result) ? ev.result : [])
          : [];
        setEvaluationIssues(issues);
      });
  }, [fileId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          评审结果 - {fileName ? fileName.replace(/\.[^/.]+$/, "") : "文档名称加载中..."}
        </h2>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" />
            复制结果
          </Button>
          <Button variant="outline" size="sm">
            导出报告
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>评审规则执行结果</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">评审规则</TableHead>
                <TableHead>结果</TableHead>
                <TableHead>问题数</TableHead>
                <TableHead>已处理</TableHead>
                <TableHead>得分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessmentResults.map((row, idx) => (
                <TableRow key={row.title}>
                  <TableCell className="font-medium">
                    {row.title === 'completeness' ? '完整性' :
                     row.title === 'consistency' ? '一致性' :
                     row.title === 'testability' ? '可测试性' :
                     row.title === 'traceability' ? '可追溯性' :
                     row.title === 'clarity' ? '清晰性' : row.title}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.result === '通过' ? 'outline' : row.result === '部分通过' ? 'default' : 'destructive'}>
                      {row.result}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.number_of_issues}</TableCell>
                  <TableCell>{row.number_of_issues_resolved}</TableCell>
                  <TableCell>{row.score}</TableCell>
                </TableRow>
              ))}
              {assessmentResults.length > 0 && (
                <TableRow className="bg-gray-50">
                  <TableCell className="font-medium">总体评分</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {Math.round(assessmentResults.reduce((sum, r) => sum + (r.score || 0), 0) / assessmentResults.length)}
                    </Badge>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>评审问题列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {evaluationIssues.map((issue, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {issue.result === "不通过" && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      {issue.result === "部分通过" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      {issue.result === "通过" && <CheckCircle className="w-4 h-4 text-green-500" />}
                      <h4 className="font-medium text-gray-900 text-base">{issue.title}</h4>
                      {issue.section_title && (
                        <Badge variant="outline" className="text-xs">
                          {issue.section_title}
                        </Badge>
                      )}
                      {issue.tag === "1" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">已采纳</Badge>
                      )}
                      {issue.tag === "-1" && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">已拒绝</Badge>
                      )}
                      {issue.tag === "0" && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">未处理</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{issue.question}</p>
                    <p className="text-sm text-blue-600 mb-3">建议：{issue.suggestion}</p>
                  </div>
                  <div className="ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // 保留再次评估逻辑
                      }}
                    >
                      再次评估
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改前后对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            {documentComparison.map((comparison) => (
              <React.Fragment key={comparison.sectionId}>
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">修改前</h3>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h4 className="font-medium text-gray-800 mb-2">{comparison.sectionTitle}</h4>
                    <p className="text-sm text-gray-600">{comparison.originalContent}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">修改后</h3>
                  <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <h4 className="font-medium text-gray-800 mb-2">{comparison.sectionTitle}</h4>
                    <p className="text-sm text-gray-600">{comparison.modifiedContent}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onBackToReview}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>上一步</span>
        </Button>
        <Button
          onClick={onNextStep}
          className="bg-orange-500 hover:bg-orange-600"
        >
          下一步
        </Button>
      </div>
    </div>
  )
} 