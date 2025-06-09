'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UploadTab } from "@/components/features/upload/UploadTab"
import { AnalysisTab } from "@/components/features/analysis/AnalysisTab"
import { ReviewTab } from "@/components/features/review/ReviewTab"
import { ResultsTab } from "@/components/features/results/ResultsTab"
import { ReportTab } from "@/components/features/report/ReportTab"
import { useState, useEffect } from "react"
import { useDocumentStore } from "@/lib/stores/documentStore"
import { useRouter } from 'next/navigation'

interface MainContentProps {
    activeTab: string
    setActiveTab: (tab: string) => void
    hasStartedAnalysis: boolean
    hasCompletedAnalysis: boolean
    hasStartedReview: boolean
    hasCompletedReview: boolean
}

 function MainContent({
                                activeTab,
                                setActiveTab,
                                hasStartedAnalysis,
                                hasCompletedAnalysis,
                                hasStartedReview,
                                hasCompletedReview,
                            }: MainContentProps) {
    const [selectedFileId, setSelectedFileId] = useState<number | undefined>(undefined);
    const [selectedFileName, setSelectedFileName] = useState<string | undefined>(undefined);
    const { documents } = useDocumentStore();
    const router = useRouter();
    const [shouldAnalyze, setShouldAnalyze] = useState<boolean>(false);

    useEffect(() => {
        const savedTab = localStorage.getItem('activeTab');
        const savedFileId = localStorage.getItem('selectedFileId');
        const savedFileName = localStorage.getItem('selectedFileName');
        if (savedTab) setActiveTab(savedTab);
        if (savedFileId) setSelectedFileId(Number(savedFileId));
        if (savedFileName) setSelectedFileName(savedFileName);
    }, []);

    useEffect(() => {
        localStorage.setItem('activeTab', activeTab);
        if (selectedFileId !== undefined) {
            localStorage.setItem('selectedFileId', String(selectedFileId));
        }
        if (selectedFileName !== undefined) {
            localStorage.setItem('selectedFileName', selectedFileName);
        }
    }, [activeTab, selectedFileId, selectedFileName]);

    function handleStartAnalysis(docId: string, shouldAnalyzeFlag: boolean) {
        setSelectedFileId(Number(docId));
        setShouldAnalyze(shouldAnalyzeFlag);
        const doc = documents.find(d => d.id === String(docId));
        setSelectedFileName(doc?.filename);
        setActiveTab("analysis");
    }

    function handleDocumentSelect(docId: string) {
        setSelectedFileId(Number(docId));
        setShouldAnalyze(false);
        const doc = documents.find(d => d.id === String(docId));
        setSelectedFileName(doc?.filename);
        setActiveTab("analysis");
    }

    function handleResetWorkflow() {
        setActiveTab("upload");
        setSelectedFileId(undefined);
    }

    function handleCompleteAnalysis() {
        setActiveTab("review");
    }

    function handleCompleteReview() {
        setActiveTab("results");
    }

    function handleBackToAnalysis() {
        setActiveTab("analysis");
    }

    function handleNextStep() {
        setActiveTab("report");
    }

    function handleBackToResults() {
        setActiveTab("results");
    }

    function handleBackToReview() {
        setActiveTab("review");
    }

    return (
        <main className="flex-1 p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="upload">文档上传</TabsTrigger>
                    <TabsTrigger value="analysis" disabled={!hasStartedAnalysis}>
                        智能分析
                    </TabsTrigger>
                    <TabsTrigger value="review" disabled={!hasCompletedAnalysis}>
                        评审确认
                    </TabsTrigger>
                    <TabsTrigger value="results" disabled={!hasStartedReview}>
                        评审结果
                    </TabsTrigger>
                    <TabsTrigger value="report" disabled={!hasCompletedReview}>
                        评估报告
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="upload">
                    <UploadTab onStartAnalysis={handleStartAnalysis} onDocumentSelect={handleDocumentSelect} />
                </TabsContent>

                <TabsContent value="analysis">
                    <AnalysisTab
                        onResetWorkflow={handleResetWorkflow}
                        onCompleteAnalysis={handleCompleteAnalysis}
                        fileId={selectedFileId}
                        fileName={selectedFileName}
                        shouldAnalyze={shouldAnalyze}
                    />
                </TabsContent>

                <TabsContent value="review">
                    <ReviewTab
                        onCompleteReview={handleCompleteReview}
                        onBackToAnalysis={handleBackToAnalysis}
                        fileId={selectedFileId?.toString()}
                        fileName={selectedFileName}
                    />
                </TabsContent>

                <TabsContent value="results">
                    <ResultsTab
                        onNextStep={handleNextStep}
                        onBackToReview={handleBackToReview}
                        fileId={selectedFileId?.toString()}
                        fileName={selectedFileName}
                    />
                </TabsContent>

                <TabsContent value="report">
                    <ReportTab onBackToResults={handleBackToResults} />
                </TabsContent>
            </Tabs>
        </main>
    )
}

export default function Page() {
    const [activeTab, setActiveTab] = useState("upload");
    const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
    const [hasCompletedAnalysis, setHasCompletedAnalysis] = useState(false);
    const [hasStartedReview, setHasStartedReview] = useState(false);
    const [hasCompletedReview, setHasCompletedReview] = useState(false);

    return (
        <MainContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasStartedAnalysis={hasStartedAnalysis}
            hasCompletedAnalysis={hasCompletedAnalysis}
            hasStartedReview={hasStartedReview}
            hasCompletedReview={hasCompletedReview}
        />
    );
}