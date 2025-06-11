"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Brain, Pause, Play, RotateCcw, Plus, Settings, AlertTriangle, MessageSquare, Clock, CheckCircle } from "lucide-react"
import { AnalysisService } from "@/lib/api/analysis"
import { AnalysisStep, AssessmentRule, IntegrityResult } from "@/types/document"
import yaml from 'js-yaml';

interface AnalysisTabProps {
  onResetWorkflow: () => void
  onCompleteAnalysis: () => void
  fileId?: number
  fileName?: string
  shouldAnalyze?: boolean
}

// YAML 解析工具
function parseYamlContent(yamlString: string) {
  // 去除 markdown 包裹
  const cleaned = yamlString.replace(/```yaml\n?|\n?```/g, '').trim();
  // 预处理：去除可能导致缩进错误的字符
  const preprocessed = cleaned.replace(/\t/g, '  ').replace(/\r/g, '');
  try {
    const results = yaml.load(preprocessed);
    if (Array.isArray(results)) {
      return results;
    }
    return [];
  } catch (e) {
    console.error('YAML parse error:', e, preprocessed);
    return [];
  }
}

// 新增：评估类型定义，扩展为五个步骤
const ASSESSMENT_TYPES = [
  {
    key: 'integrity',
    prompt_title: 'integrity-assessment',
    stepId: 'step4',
    stepTitle: '完整性评估',
  },
  {
    key: 'consistency',
    prompt_title: 'consistency-assessment',
    stepId: 'step5',
    stepTitle: '一致性评估',
  },
  {
    key: 'testability',
    prompt_title: 'testability-assessment',
    stepId: 'step6',
    stepTitle: '可测试性评估',
  },
  {
    key: 'traceability',
    prompt_title: 'traceability-assessment',
    stepId: 'step7',
    stepTitle: '可追溯性评估',
  },
  {
    key: 'clarity',
    prompt_title: 'clarity-assessment',
    stepId: 'step8',
    stepTitle: '明确性评估',
  },
];

// 新增：评估结果展示组件
function AssessmentResultsDisplay({ results, type }: { results: IntegrityResult[]; type: string }) {
  // 获取评估类型特定的图标，仅区分icon和iconColor，卡片边框统一橙色
  const getIconAndColor = (result: IntegrityResult) => {
    // 通过/部分通过/不通过/冲突/矛盾/不一致
    if (result.result === '不通过' || result.result.includes('冲突') || result.result.includes('矛盾')) {
      return { icon: AlertTriangle, iconColor: 'text-red-500' };
    }
    if (result.result === '部分通过' || result.result.includes('不一致')) {
      return { icon: AlertTriangle, iconColor: 'text-orange-500' };
    }
    // 通过
    return { icon: CheckCircle, iconColor: 'text-green-500' };
  };

  // 按结果类型分组
  const groupedResults = results.reduce((acc, result) => {
    const key = result.result === '不通过' ? 'failed' : 
                result.result === '部分通过' ? 'partial' : 'passed';
    if (!acc[key]) acc[key] = [];
    acc[key].push(result);
    return acc;
  }, {} as Record<string, IntegrityResult[]>);

  return (
    <div className="space-y-3">
      {/* 不通过 */}
      {groupedResults.failed?.map((result, index) => {
        const { icon: Icon, iconColor } = getIconAndColor(result);
        return (
          <div
            key={`failed-${result.title}-${index}`}
            className={`rounded-lg border text-card-foreground shadow-sm border-l-4 border-l-orange-500`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <h4 className="font-medium text-gray-900 text-sm">{result.title}</h4>
                  </div>
                  <p className="text-xs text-gray-600">{result.question}</p>
                </div>
                {result.section_title && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs ml-2">
                    {result.section_title}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {/* 部分通过 */}
      {groupedResults.partial?.map((result, index) => {
        const { icon: Icon, iconColor } = getIconAndColor(result);
        return (
          <div
            key={`partial-${result.title}-${index}`}
            className={`rounded-lg border text-card-foreground shadow-sm border-l-4 border-l-orange-500`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <h4 className="font-medium text-gray-900 text-sm">{result.title}</h4>
                  </div>
                  <p className="text-xs text-gray-600">{result.question}</p>
                </div>
                {result.section_title && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs ml-2">
                    {result.section_title}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {/* 通过 */}
      {groupedResults.passed?.map((result, index) => {
        const { icon: Icon, iconColor } = getIconAndColor(result);
        return (
          <div
            key={`passed-${result.title}-${index}`}
            className={`rounded-lg border text-card-foreground shadow-sm border-l-4 border-l-orange-500`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <h4 className="font-medium text-gray-900 text-sm">{result.title}</h4>
                  </div>
                  <p className="text-xs text-gray-600">{result.question}</p>
                </div>
                {result.section_title && (
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold text-xs ml-2">
                    {result.section_title}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 新增：评估结果概要展示组件
function AssessmentSummaryDisplay({ results, type }: { results: IntegrityResult[]; type: string }) {
  const failedResults = results.filter(
    result => result.result === '不通过' || result.result === '部分通过' || 
              (type === '一致性评估' && (result.result.includes('冲突') || result.result.includes('矛盾')))
  );
  const failedCount = failedResults.length;
  
  if (failedCount > 0) {
    const sectionTitles = Array.from(
      new Set(
        failedResults
          .filter(result => result.section_title && result.section_title.trim() !== '')
          .map(result => result.section_title)
      )
    );

    // 获取评估类型特定的样式
    const getTypeSpecificStyles = () => {
      if (type === '一致性评估') {
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-100',
          iconColor: 'text-red-500'
        };
      }
      return {
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-100',
        iconColor: 'text-yellow-500'
      };
    };

    const styles = getTypeSpecificStyles();

    return (
      <div className={`mb-4 p-3 ${styles.bgColor} border ${styles.borderColor} rounded-md`}>
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className={`w-4 h-4 ${styles.iconColor}`} />
          <p className="text-xs text-gray-800">
            发现 {failedCount} 个{type}问题
            {sectionTitles.length > 0 && (
              <span>，主要集中在 {sectionTitles.join('、')} 章节</span>
            )}
          </p>
        </div>
      </div>
    );
  }
  return results.length > 0 ? (
    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-md">
      <div className="flex items-center space-x-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <p className="text-xs text-gray-800">
          {type}检查通过，未发现问题
        </p>
      </div>
    </div>
  ) : null;
}

// 新增：评估步骤展示组件
function AssessmentStepDisplay({ 
  step, 
  type, 
  summaryResults,
  currentStep,
  shouldAnalyze
}: { 
  step: AnalysisStep; 
  type: string; 
  summaryResults: IntegrityResult[];
  currentStep: string;
  shouldAnalyze: boolean;
}) {
  return (
    <div key={step.id} className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          {step.status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}
          {step.status === "in-progress" && <RotateCcw className="w-4 h-4 text-blue-500 animate-spin" />}
          {step.status === "pending" && <Clock className="w-4 h-4 text-gray-400" />}
          <span
            className={
              step.status === "completed"
                ? "text-green-600"
                : step.status === "in-progress"
                  ? "text-blue-600"
                  : "text-gray-500"
            }
          >
            {step.title}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {step.status === "completed"
            ? "完成"
            : step.status === "in-progress"
              ? "进行中"
              : "等待中"}
        </span>
      </div>
      <p className="text-xs text-gray-500 ml-6">{step.description}</p>
      {/* shouldAnalyze为true且步骤完成时，展示汇总 */}
      {shouldAnalyze && step.status === 'completed' && summaryResults.length > 0 && (
        <div className="ml-6 mt-2">
          <AssessmentSummaryDisplay results={summaryResults} type={type} />
        </div>
      )}
      {/* shouldAnalyze为false时，原有逻辑不变 */}
      {!shouldAnalyze && summaryResults.length > 0 && (
        <div className="ml-6 mt-2">
          <AssessmentSummaryDisplay results={summaryResults} type={type} />
        </div>
      )}
    </div>
  );
}

export function AnalysisTab({ onResetWorkflow, onCompleteAnalysis, fileId, fileName, shouldAnalyze }: AnalysisTabProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [reviewProgress, setReviewProgress] = useState(0)
  const [currentReviewSection, setCurrentReviewSection] = useState("")
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState<string>("")
  const [currentAnalysisStepStatus, setCurrentAnalysisStepStatus] = useState<'pending' | 'in-progress' | 'completed' | 'error'>('pending')
  const [assessmentResults, setAssessmentResults] = useState<IntegrityResult[]>([])
  const [assessmentSummary, setAssessmentSummary] = useState<IntegrityResult[]>([])
  const [assessmentRules, setAssessmentRules] = useState<AssessmentRule[]>([])
  const [analysisSteps, setAnalysisSteps] = useState<AnalysisStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileIdRef = useRef<number | undefined>(undefined)
  const isInitialized = useRef(false)

  // 新增：当前评估阶段索引
  const [currentAssessmentIndex, setCurrentAssessmentIndex] = useState(0);
  const currentAssessment = ASSESSMENT_TYPES[currentAssessmentIndex];

  // 新增：完整性评估结果状态
  const [integrityResults, setIntegrityResults] = useState<IntegrityResult[]>([]);
  const [integritySummary, setIntegritySummary] = useState<IntegrityResult[]>([]);

  // 新增：一致性评估结果状态
  const [consistencyResults, setConsistencyResults] = useState<IntegrityResult[]>([]);
  const [consistencySummary, setConsistencySummary] = useState<IntegrityResult[]>([]);

  // 新增：按步骤存储实时结果和汇总结果
  const [assessmentResultsMap, setAssessmentResultsMap] = useState<Record<string, IntegrityResult[]>>({});
  const [assessmentSummaryMap, setAssessmentSummaryMap] = useState<Record<string, IntegrityResult[]>>({});

  const assessmentStartedRef = useRef(false);

  // 新增：后端已分析数据
  const [backendEvaluations, setBackendEvaluations] = useState<any[]>([]);
  const [hasBackendEvaluations, setHasBackendEvaluations] = useState(false);

  // 日志：组件渲染时打印关键状态
  console.log('AnalysisTab 渲染', { fileId, shouldAnalyze, currentAssessmentIndex });

  // 每次 fileId 或 shouldAnalyze 变化时，重置分析相关状态
  useEffect(() => {
    setCurrentAssessmentIndex(0);
    setAssessmentResultsMap({});
    setAssessmentSummaryMap({});
    setIsAnalyzing(false);
    setIsPaused(false);
    setReviewProgress(0);
    setCurrentReviewSection("");
    setCurrentAnalysisStep("");
    setCurrentAnalysisStepStatus('pending');
    setAssessmentResults([]);
    setAssessmentSummary([]);
    setIntegrityResults([]);
    setIntegritySummary([]);
    setConsistencyResults([]);
    setConsistencySummary([]);
    assessmentStartedRef.current = false;
  }, [fileId, shouldAnalyze]);

  // 修改：监听评估阶段变化，自动发起评估（仅 shouldAnalyze 为 true 且无后端评估时）
  useEffect(() => {
    console.log('自动分析 useEffect 触发', {
      fileId,
      hasBackendEvaluations,
      shouldAnalyze,
      assessmentStarted: assessmentStartedRef.current,
      currentAssessmentIndex,
      currentStepResults: currentAssessment && currentAssessment.stepId ? assessmentResultsMap[currentAssessment.stepId] : undefined
    });
    if (!fileId || hasBackendEvaluations || !shouldAnalyze) {
      return;
    }
    if (!currentAssessment || !currentAssessment.stepId) {
      return;
    }
    if (assessmentStartedRef.current) {
      return;
    }
    const currentStepResults = assessmentResultsMap[currentAssessment.stepId] || [];
    if (currentStepResults.length > 0) {
      return;
    }
    if (currentAssessmentIndex >= ASSESSMENT_TYPES.length) {
      return;
    }
    assessmentStartedRef.current = true;
    console.log('开始评估:', {
      prompt_title: currentAssessment.prompt_title,
      provider: 'deepseek',
      stream: true,
      file_id: fileId,
      system_prompt: '你是一个专业的产品经理，在车企工作了20多年，熟悉车企相关需求的分析、评估标准。'
    });
    handleAssessment(currentAssessment, fileId).finally(() => {
      assessmentStartedRef.current = false;
    });
  }, [currentAssessmentIndex, hasBackendEvaluations, fileId, currentAssessment, shouldAnalyze]);

  // 更新 fileIdRef
  useEffect(() => {
    fileIdRef.current = fileId
  }, [fileId])

  // 通用评估处理逻辑
  const handleAssessment = useCallback(async (
    assessmentType: { key: string; prompt_title: string; stepId: string; stepTitle: string },
    fileId: number
  ) => {
    if (!fileId) return;
    // 修正：保存summary结果用于status:completed时直接使用，避免异步setState导致results为空
    let latestSummaryResults: IntegrityResult[] = [];
    const evaluationTypeMap: Record<string, 'completeness' | 'consistency' | 'testability' | 'traceability' | 'clarity'> = {
      integrity: 'completeness',
      consistency: 'consistency',
      testability: 'testability',
      traceability: 'traceability',
      clarity: 'clarity',
    };
    const evaluation_type = evaluationTypeMap[assessmentType.key];
    setIsAnalyzing(true);
    setIsPaused(false);
    setReviewProgress(0);
    setCurrentReviewSection('');
    setCurrentAnalysisStep(assessmentType.stepId);
    setCurrentAnalysisStepStatus('in-progress');

    // 清空当前步骤的结果
    setAssessmentResultsMap(prev => ({ ...prev, [assessmentType.stepId]: [] }));
    setAssessmentSummaryMap(prev => ({ ...prev, [assessmentType.stepId]: [] }));

    // 如果是完整性评估，清空完整性结果
    if (assessmentType.key === 'integrity') {
      setIntegrityResults([]);
      setIntegritySummary([]);
    }
    // 如果是一致性评估，清空一致性结果
    if (assessmentType.key === 'consistency') {
      setConsistencyResults([]);
      setConsistencySummary([]);
    }

    // 更新分析步骤状态
    setAnalysisSteps(steps =>
      steps.map(step => {
        if (step.id === 'step9') {
          return { ...step, status: 'pending', progress: 0 };
        }
        return {
          ...step,
          status: step.id === assessmentType.stepId
            ? 'in-progress'
            : ASSESSMENT_TYPES.findIndex(t => t.stepId === step.id) < ASSESSMENT_TYPES.findIndex(t => t.stepId === assessmentType.stepId)
              ? 'completed'
              : 'pending',
          progress: step.id === assessmentType.stepId
            ? 0
            : ASSESSMENT_TYPES.findIndex(t => t.stepId === step.id) < ASSESSMENT_TYPES.findIndex(t => t.stepId === assessmentType.stepId)
              ? 100
              : 0
        };
      })
    );

    try {
      const analysisService = AnalysisService.getInstance();
      await analysisService.startAssessment({
        prompt_title: assessmentType.prompt_title,
        provider: 'deepseek',
        stream: true,
        file_id: fileId,
        system_prompt: '你是一个专业的产品经理，在车企工作了20多年，熟悉车企相关需求的分析、评估标准。'
      }, (data) => {
        if (data.type === 'summary' && data.content) {
          const parsed = parseYamlContent(data.content);
          console.log('解析的 summary 结果:', parsed);
          setAssessmentResultsMap(prev => {
            const prevResults = prev[assessmentType.stepId] || [];
            const allResults = [...prevResults, ...parsed];
            // 去重
            const uniqueResults = allResults.filter(
              (item, idx, arr) =>
                arr.findIndex(
                  r => r.title === item.title && r.section_title === item.section_title
                ) === idx
            );
            // 排序
            const sortedResults = uniqueResults.sort((a, b) => {
              const getResultWeight = (result: string) => {
                if (result === '不通过') return 3;
                if (result === '部分通过') return 2;
                return 1;
              };
              return getResultWeight(b.result) - getResultWeight(a.result);
            });
            console.log('合并后的评估结果:', sortedResults);
            return { ...prev, [assessmentType.stepId]: sortedResults };
          });
          setAssessmentSummaryMap(prev => ({ ...prev, [assessmentType.stepId]: parsed }));

          // 如果是完整性评估，保存结果
          if (assessmentType.key === 'integrity') {
            setIntegritySummary(parsed);
            setIntegrityResults(parsed);
          }
          // 如果是一致性评估，保存结果
          if (assessmentType.key === 'consistency') {
            setConsistencySummary(parsed);
            setConsistencyResults(parsed);
          }
        } else if (data.type === 'realtime' && data.results) {
          setAssessmentResultsMap(prev => {
            const prevResults = prev[assessmentType.stepId] || [];
            const exists = prevResults.some(
              prevItem => prevItem.title === data.results.title && 
                          prevItem.section_title === data.results.section_title
            );
            if (!exists) {
              const newResults = [...prevResults, data.results];
              const sorted = newResults.sort((a, b) => {
                const getResultWeight = (result: string) => {
                  if (result === '不通过') return 3;
                  if (result === '部分通过') return 2;
                  return 1;
                };
                return getResultWeight(b.result) - getResultWeight(a.result);
              });
              // 确保更新后的结果被正确保存
              const updatedMap = { ...prev, [assessmentType.stepId]: sorted };
              console.log('更新后的 assessmentResultsMap:', updatedMap);
              return updatedMap;
            }
            return prev;
          });

          // 如果是完整性评估，保存实时结果
          if (assessmentType.key === 'integrity') {
            setIntegrityResults(prevResults => {
              const exists = prevResults.some(
                prev => prev.title === data.results.title && 
                       prev.section_title === data.results.section_title
              );
              if (!exists) {
                const newResults = [...prevResults, data.results];
                return newResults.sort((a, b) => {
                  const getResultWeight = (result: string) => {
                    if (result === '不通过') return 3;
                    if (result === '部分通过') return 2;
                    return 1;
                  };
                  return getResultWeight(b.result) - getResultWeight(a.result);
                });
              }
              return prevResults;
            });
          }
          // 如果是一致性评估，保存实时结果
          if (assessmentType.key === 'consistency') {
            setConsistencyResults(prevResults => {
              const exists = prevResults.some(
                prev => prev.title === data.results.title && 
                       prev.section_title === data.results.section_title
              );
              if (!exists) {
                const newResults = [...prevResults, data.results];
                return newResults.sort((a, b) => {
                  const getResultWeight = (result: string) => {
                    if (result === '不通过') return 3;
                    if (result === '部分通过') return 2;
                    return 1;
                  };
                  return getResultWeight(b.result) - getResultWeight(a.result);
                });
              }
              return prevResults;
            });
          }
        } else if (data.type === 'status' && data.status === 'completed') {
          // 更新当前步骤状态为完成
          setCurrentAnalysisStepStatus('completed');
          setIsAnalyzing(false);

          // 更新分析步骤状态
          setAnalysisSteps(steps =>
            steps.map(step => {
              if (step.id === assessmentType.stepId) {
                return { ...step, status: 'completed', progress: 100 };
              }
              // 如果是最后一个评估步骤，同时更新生成报告步骤为进行中
              if (assessmentType.stepId === 'step8' && step.id === 'step9') {
                return { ...step, status: 'in-progress', progress: 0 };
              }
              return step;
            })
          );

          // 在步骤完成时，统一保存评估结果
          console.log('当前步骤 ID:', assessmentType.stepId);
          console.log('当前 assessmentResultsMap:', assessmentResultsMap);
          
          // 使用函数式更新确保获取最新的状态
          setAssessmentResultsMap(prev => {
            const currentResults = prev[assessmentType.stepId] || [];
            console.log('保存的评估结果:', currentResults);
            
            // 确保有结果才进行保存
            if (currentResults.length > 0) {
              AnalysisService.saveEvaluationResult({
                file_id: fileId,
                evaluation_type,
                results: currentResults.map(r => ({
                  ...r,
                  section_title: r.section_title == null ? "" : r.section_title
                }))
              }).catch((e: unknown) => console.error('保存评估结果失败', e));
            } else {
              console.warn('没有评估结果需要保存');
            }
            
            return prev;
          });

          // 自动进入下一个评估阶段（如有）
          if (typeof shouldAnalyze !== 'undefined' && shouldAnalyze && currentAssessmentIndex + 1 < ASSESSMENT_TYPES.length) {
            setCurrentAssessmentIndex(currentAssessmentIndex + 1);
          }
        } else if (data.type === 'error') {
          const errorMessage = assessmentType.key === 'consistency' 
            ? '一致性评估过程中出现错误，请检查文档格式或重试'
            : '评估过程中出现错误，请重试';
          setError(errorMessage);
          setCurrentAnalysisStepStatus('error');
          setIsAnalyzing(false);
        }
      });
    } catch (error) {
      const errorMessage = assessmentType.key === 'consistency'
        ? '一致性评估失败，请检查文档格式或重试'
        : '评估失败，请重试';
      setError(errorMessage);
      setCurrentAnalysisStepStatus('error');
      setIsAnalyzing(false);
    }
  }, [currentAssessmentIndex]);

  // 修改：加载后端评估结果
  useEffect(() => {
    if (!fileId) return;
    
    console.log('开始加载后端评估结果...');
    setHasBackendEvaluations(false);
    setBackendEvaluations([]);
    
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
    fetch(`${BASE_URL}/files/${fileId}/latest-evaluation`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.evaluations) && data.evaluations.length > 0) {
          console.log('发现已有评估结果:', data.evaluations);
          setBackendEvaluations(data.evaluations);
          setHasBackendEvaluations(true);
          
          // 解析并填充所有步骤的评估结果和状态
          const summaryMap: Record<string, IntegrityResult[]> = {};
          const steps: AnalysisStep[] = [];
          ASSESSMENT_TYPES.forEach((type, idx) => {
            // 找到该类型的评估
            const found = data.evaluations.find((ev: any) => 
              ev.evaluation_type === type.key || 
              ev.evaluation_type === type.stepTitle || 
              ev.evaluation_type === type.prompt_title
            );
            if (found && Array.isArray(found.result)) {
              summaryMap[type.stepId] = found.result;
              // 更新步骤状态为已完成
              steps.push({
                id: type.stepId,
                title: type.stepTitle,
                description: '',
                status: 'completed',
                progress: 100,
              });
            } else {
              summaryMap[type.stepId] = [];
              // 保持步骤状态为待处理
              steps.push({
                id: type.stepId,
                title: type.stepTitle,
                description: '',
                status: 'pending',
                progress: 0,
              });
            }
          });
          setAssessmentSummaryMap(summaryMap);
          setAssessmentResultsMap(summaryMap);
          
          // 更新分析步骤状态
          setAnalysisSteps(prevSteps => {
            return prevSteps.map(step => {
              const updatedStep = steps.find(s => s.id === step.id);
              if (updatedStep) {
                return {
                  ...step,
                  status: updatedStep.status,
                  progress: updatedStep.progress
                };
              }
              return step;
            });
          });

          // 如果有评估结果，禁用所有评估相关功能
          setIsAnalyzing(false);
          assessmentStartedRef.current = true;
          setCurrentAssessmentIndex(ASSESSMENT_TYPES.length); // 设置到最后一个步骤
        } else {
          console.log('未发现已有评估结果');
          setHasBackendEvaluations(false);
          assessmentStartedRef.current = false;
        }
      })
      .catch(error => {
        console.error('获取评估结果失败:', error);
        setHasBackendEvaluations(false);
        assessmentStartedRef.current = false;
      });
  }, [fileId]);

  // 初始化数据
  useEffect(() => {
    const analysisService = AnalysisService.getInstance();
    
    // 获取评估规则
    analysisService.getAssessmentRules().then(response => {
      if (response.status === 'success' && response.data) {
        setAssessmentRules(response.data);
      }
    });

    // 初始化所有步骤
    const initialSteps = [
      {
        id: 'step1',
        title: '文档解析',
        description: '解析上传的文档内容',
        status: 'completed' as const,
        progress: 100
      },
      {
        id: 'step2',
        title: '需求提取',
        description: '从文档中提取需求信息',
        status: 'completed' as const,
        progress: 100
      },
      {
        id: 'step3',
        title: '规则加载',
        description: '加载评估规则',
        status: 'completed' as const,
        progress: 100
      },
      {
        id: 'step4',
        title: '完整性评估',
        description: '评估需求的完整性',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'step5',
        title: '一致性评估',
        description: '评估需求的一致性',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'step6',
        title: '可测试性评估',
        description: '评估需求的可测试性',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'step7',
        title: '可追溯性评估',
        description: '评估需求的可追溯性',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'step8',
        title: '明确性评估',
        description: '评估需求的明确性',
        status: 'pending' as const,
        progress: 0
      },
      {
        id: 'step9',
        title: '生成评估报告',
        description: '生成最终的评估报告',
        status: 'pending' as const,
        progress: 0
      }
    ];

    // 设置初始步骤
    setAnalysisSteps(initialSteps);

    // 获取分析步骤（如果需要从后端获取额外信息）
    analysisService.getAnalysisSteps().then(response => {
      if (response.status === 'success' && response.data) {
        // 更新评估步骤的状态，但保持其他步骤不变
        setAnalysisSteps(prevSteps => {
          return prevSteps.map(step => {
            const backendStep = response.data.find(s => s.id === step.id);
            if (backendStep) {
              return {
                ...step,
                status: backendStep.status,
                progress: backendStep.progress
              };
            }
            return step;
          });
        });
      }
    });
  }, []);

  // 修改：动态计算总体进度条
  useEffect(() => {
    if (analysisSteps.length > 0) {
      const total = analysisSteps.length;
      const completed = analysisSteps.filter(s => s.status === 'completed').length;
      setReviewProgress(Math.round((completed / total) * 100));
    }
  }, [analysisSteps]);

  // Handle pausing analysis
  const handlePauseAnalysis = () => {
    setIsPaused(!isPaused);
  };

  // 修改：重新评估按钮的处理函数
  const handleRestartAnalysis = useCallback(() => {
    if (!fileId || hasBackendEvaluations) {
      console.log('已有评估结果，不允许重新评估');
      return;
    }

    console.log('重新开始评估');
    isInitialized.current = false;
    // 重置状态
    setIsAnalyzing(true);
    setIsPaused(false);
    setReviewProgress(0);
    setCurrentReviewSection("");
    setCurrentAnalysisStep("step1");
    setAssessmentResults([]);
    setAssessmentSummary([]);
    setCurrentAssessmentIndex(0); // 重置到第一个评估步骤

    // Reset analysis steps
    setAnalysisSteps((steps) =>
      steps.map((step) => ({
        ...step,
        status: step.id === "step1" ? "in-progress" : "pending",
        progress: step.id === "step1" ? 0 : 0,
      })),
    );
    // 不再主动发起评估，交由 useEffect 自动触发
  }, [fileId, hasBackendEvaluations]);

  // Toggle assessment rule
  const handleToggleRule = (ruleId: string) => {
    setAssessmentRules((rules) =>
      rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)),
    )
  }

  // 自动切换分析步骤到 step4
  useEffect(() => {
    if (assessmentResults.length > 0 && currentAnalysisStep !== 'step4') {
      setCurrentAnalysisStep('step4');
      setAnalysisSteps(steps =>
        steps.map(step =>
          step.id === 'step4'
            ? { ...step, status: 'in-progress' }
            : step
        )
      );
    }
  }, [assessmentResults, currentAnalysisStep]);

  // 在收到 summary 或 status: completed 时，切换 step4 为 completed
  useEffect(() => {
    if ((assessmentSummary.length > 0 || currentAnalysisStepStatus === 'completed') && currentAnalysisStep !== 'step4') {
      setCurrentAnalysisStep('step4');
      setAnalysisSteps(steps =>
        steps.map(step =>
          step.id === 'step4'
            ? { ...step, status: 'completed', progress: 100 }
            : step
        )
      );
    }
  }, [assessmentSummary, currentAnalysisStepStatus, currentAnalysisStep]);

  // 监听 assessmentSummary，自动同步到 assessmentResults
  useEffect(() => {
    if (assessmentSummary.length > 0) {
      setAssessmentResults(assessmentSummary);
    }
  }, [assessmentSummary]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>{fileName ? fileName.replace(/\.[^/.]+$/, "") : "未命名文档"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary">v1.2.0 汽车行业</Badge>
            {!hasBackendEvaluations && (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePauseAnalysis}
                  disabled={!isAnalyzing}
                  className="flex items-center space-x-1"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  <span>{isPaused ? "继续" : "暂停"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestartAnalysis}
                  className="flex items-center space-x-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>重新评估</span>
                </Button>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">评估规则</h3>
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" className="flex items-center space-x-1">
                <Plus className="w-4 h-4" />
                <span>添加规则</span>
              </Button>
              <Button variant="outline" size="sm" className="flex items-center space-x-1">
                <Settings className="w-4 h-4" />
                <span>编辑</span>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {assessmentRules.map((rule) => (
              <div
                key={rule.id}
                className={`border rounded-md p-2 cursor-pointer transition-colors ${
                  rule.enabled ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
                }`}
                onClick={() => handleToggleRule(rule.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{rule.title}</span>
                  <Badge variant={rule.enabled ? "default" : "outline"} className="text-xs">
                    {rule.severity}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 truncate">{rule.category}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium text-gray-900">分析进度</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">总体进度</span>
              <span className="text-sm text-gray-500">{reviewProgress}%</span>
            </div>
            <Progress value={reviewProgress} className="h-2" />
          </div>
          <div className="space-y-3">
            {analysisSteps.map((step) => (
              <AssessmentStepDisplay 
                key={step.id} 
                step={step} 
                type={step.title}
                summaryResults={
                  shouldAnalyze
                    ? (assessmentResultsMap[step.id] || [])
                    : (assessmentSummaryMap[step.id] || [])
                }
                currentStep={currentAnalysisStep}
                shouldAnalyze={!!shouldAnalyze}
              />
            ))}
          </div>
        </div>

        {/* 实时评估结果区块（shouldAnalyze为true时，展示最近一个completed步骤的实时评估结果） */}
        {shouldAnalyze && (() => {
          const latestStep = analysisSteps.findLast(
            step => step.status === 'completed'
          );
          if (!latestStep) return null;
          const stepType = ASSESSMENT_TYPES.find(t => t.stepId === latestStep.id);
          const results = assessmentResultsMap[latestStep.id] || [];
          if (!results.length) return null;
          return (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-2">实时评估结果</h3>
              <AssessmentResultsDisplay results={results} type={stepType?.stepTitle || ''} />
            </div>
          );
        })()}
      </CardContent>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={onResetWorkflow}
          className="flex items-center space-x-2"
        >
          <span>上一步</span>
        </Button>
        <Button
          onClick={onCompleteAnalysis}
          className="bg-orange-500 hover:bg-orange-600"
        >
          下一步
        </Button>
      </div>
    </Card>
  )
} 