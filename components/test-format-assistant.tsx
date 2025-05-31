'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Copy, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { streamingAICall } from '@/lib/services/ai-service'
import yaml from 'yaml'
import { testFormatPromptTemplate } from '@/lib/prompts'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useTranslations } from 'next-intl'

interface TestCase {
  type: string
  summary: string
  preconditions: string
  steps: string
  expected_result: string
}

interface YamlData {
  test_cases: TestCase[]
}

export function TestFormatAssistant() {
  const t = useTranslations('TestFormatAssistant')
  const [testDescription, setTestDescription] = useState('')
  const [result, setResult] = useState('')
  const [parsedResult, setParsedResult] = useState<TestCase[]>([])
  const [isFormatting, setIsFormatting] = useState(false)
  const [isOutputComplete, setIsOutputComplete] = useState(false)
  const [editableTestCases, setEditableTestCases] = useState<TestCase[]>([])
  const { toast } = useToast()

  // 监听结果变化，尝试解析YAML
  useEffect(() => {
    if (result) {
      handleParseYaml(result)
    }
  }, [result])

  const handleFormat = async () => {
    if (!testDescription.trim()) return

    setIsFormatting(true)
    setResult('')
    setParsedResult([])
    setIsOutputComplete(false)
    let formattedResult = ''

    try {
      const prompt = testFormatPromptTemplate.replace('{test_description}', testDescription)

      await streamingAICall(
        prompt,
        (content: string) => {
          formattedResult += content
          setResult(formattedResult)
        },
        (error: string) => {
          throw new Error(`${t('formatFailed')}: ${error}`)
        }
      )

      setIsOutputComplete(true)
      toast({
        title: t('formatSuccess'),
        description: t('formatSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Format error:', error)
      toast({
        variant: "destructive",
        title: t('formatFailed'),
        description: error instanceof Error ? error.message : "未知错误",
        duration: 3000
      })
    } finally {
      setIsFormatting(false)
    }
  }

  const handleParseYaml = (content: string) => {
    try {
      const parsed: YamlData = yaml.parse(content)
      if (parsed?.test_cases && Array.isArray(parsed.test_cases)) {
        const validTestCases = parsed.test_cases.filter(testCase => 
          testCase && typeof testCase === 'object'
        ) as TestCase[]
        
        if (validTestCases.length > 0) {
          setParsedResult(validTestCases)
          setEditableTestCases(validTestCases)
          return true
        }
      }
    } catch {
      // 静默处理解析错误
      return false
    }
    return false
  }

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(result)
      toast({
        title: t('copySuccess'),
        description: t('copyYAMLSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Copy error:', error)
      toast({
        variant: "destructive",
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        duration: 3000
      })
    }
  }

  const handleCopyTable = async () => {
    try {
      // 生成TSV格式（Excel可以直接粘贴）
      const header = [t('type'), t('summary'), t('preconditions'), t('steps'), t('expectedResult')].join('\t')
      const rows = parsedResult.map(testCase => {
        // 处理步骤中的换行，将其替换为分号加空格
        const steps = testCase?.steps?.replace(/\n/g, '; ') || ''
        
        return [
          testCase?.type || '',
          testCase?.summary || '',
          testCase?.preconditions || '',
          steps,
          testCase?.expected_result || ''
        ].join('\t')
      })
      
      const tableContent = [header, ...rows].join('\n')
      await navigator.clipboard.writeText(tableContent)
      
      toast({
        title: t('copySuccess'),
        description: t('copyTableSuccessDesc'),
        duration: 3000
      })
    } catch (error) {
      console.error('Copy table error:', error)
      toast({
        variant: "destructive",
        title: t('copyFailed'),
        description: t('copyFailedDesc'),
        duration: 3000
      })
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('inputTitle')}</h2>
        <Textarea
          placeholder={t('inputPlaceholder')}
          value={testDescription}
          onChange={(e) => setTestDescription(e.target.value)}
          className="min-h-[100px] w-full"
        />
      </div>

      <div className="flex justify-center mt-1 w-full">
        <Button
          onClick={handleFormat}
          disabled={!testDescription.trim() || isFormatting}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isFormatting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('formatting')}
            </>
          ) : (
            t('formatButton')
          )}
        </Button>
      </div>

      {editableTestCases.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex justify-end gap-2 mb-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  title={t('reset')}
                  disabled={!isOutputComplete}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('reset')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('confirmReset')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('resetConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    setEditableTestCases(parsedResult)
                    setIsOutputComplete(false)
                  }}>{t('confirmReset')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyTable}
              title={t('copyTable')}
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              {t('copyTable')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyYaml}
              title={t('copyYAML')}
              disabled={!isOutputComplete}
            >
              <Copy className="h-4 w-4 mr-1" />
              {t('copyYAML')}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('type')}</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('summary')}</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('preconditions')}</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('steps')}</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('expectedResult')}</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-gray-900">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {editableTestCases.map((testCase, index) => (
                  <tr key={index} className="even:bg-gray-50">
                    {(['type', 'summary', 'preconditions', 'steps', 'expected_result'] as const).map((field) => (
                      <td key={field} className="px-3 py-2 text-sm">
                        {testCase[field]}
                      </td>
                    ))}
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('deleteConfirmDesc')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              const newTestCases = editableTestCases.filter((_, i) => i !== index)
                              setEditableTestCases(newTestCases)
                            }}>
                              {t('confirmDelete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
} 