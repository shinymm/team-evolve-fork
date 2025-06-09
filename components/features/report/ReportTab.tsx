"use client"

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { ResultsService, ReportStats, RuleIssueMapping } from "@/lib/api/results"

interface ReportTabProps {
  onBackToResults: () => void;
}

export const ReportTab: React.FC<ReportTabProps> = ({ onBackToResults }) => {
  const [currentDocumentTitle] = useState("智能驾驶系统PRD");
  const [reportStats, setReportStats] = useState<ReportStats | null>(null);
  const [ruleIssueMapping, setRuleIssueMapping] = useState<RuleIssueMapping[]>([]);

  useEffect(() => {
    const resultsService = ResultsService.getInstance();

    // Get report statistics
    resultsService.getReportStats().then(response => {
      if (response.status === 'success' && response.data) {
        setReportStats(response.data);
      }
    });

    // Get rule issue mapping
    resultsService.getRuleIssueMapping().then(response => {
      if (response.status === 'success' && response.data) {
        setRuleIssueMapping(response.data);
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>评估报告 - {currentDocumentTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{reportStats?.solvedIssues || 0}</div>
                <div className="text-sm text-gray-600">已解决问题</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{reportStats?.pendingIssues || 0}</div>
                <div className="text-sm text-gray-600">待处理问题</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{reportStats?.documentQuality || 0}%</div>
                <div className="text-sm text-gray-600">文档质量评分</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{reportStats?.firstConfirmationRate || 0}%</div>
                <div className="text-sm text-gray-600">一次确认率</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">评审规则统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">启用规则数量</span>
                      <span className="font-medium">5/5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">发现问题总数</span>
                      <span className="font-medium">11</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">高优先级问题</span>
                      <span className="font-medium text-red-600">4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">中优先级问题</span>
                      <span className="font-medium text-yellow-600">5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">低优先级问题</span>
                      <span className="font-medium text-blue-600">2</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">问题分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">需求完整性</span>
                      <span className="font-medium">4 问题</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">需求明确性</span>
                      <span className="font-medium">3 问题</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">需求一致性</span>
                      <span className="font-medium">2 问题</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">需求可测试性</span>
                      <span className="font-medium">1 问题</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">需求可追溯性</span>
                      <span className="font-medium">1 问题</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">规则-问题-建议映射</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ruleIssueMapping.map((mapping) => (
                    <div key={mapping.ruleId} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{mapping.ruleName}</h4>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="text-red-600">问题:</span>{" "}
                          {mapping.issues.join("、")}
                        </div>
                        <div className="text-sm">
                          <span className="text-blue-600">建议:</span>{" "}
                          {mapping.suggestions.join("、")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">疑似有问题的评审规则</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">需求一致性检查规则</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      该规则在检测性能指标与安全要求的冲突时，可能存在误报。建议优化规则逻辑，区分不同类型的性能要求。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">改进建议摘要</h3>
              <ul className="space-y-2">
                <li className="flex items-start space-x-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-gray-400" />
                  <span className="text-sm text-gray-600">建议为所有性能指标添加明确的测试方法和验收标准</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-gray-400" />
                  <span className="text-sm text-gray-600">需要补充极端场景和边缘案例的处理方案</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-gray-400" />
                  <span className="text-sm text-gray-600">建议增加法规标准要求和合规性说明</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-gray-400" />
                  <span className="text-sm text-gray-600">完善用户界面交互设计的具体细节</span>
                </li>
                <li className="flex items-start space-x-2">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-gray-400" />
                  <span className="text-sm text-gray-600">添加系统异常处理机制和故障安全设计</span>
                </li>
              </ul>
            </div>

            <Button className="w-full bg-orange-500 hover:bg-orange-600">下载完整评估报告</Button>
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onBackToResults}
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>上一步</span>
        </Button>
      </div>
    </div>
  )
} 