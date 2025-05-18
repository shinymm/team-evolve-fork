'use client'

import { useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ContentDisplayProps {
  content: string;
}

export const ContentDisplay = ({ content }: ContentDisplayProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // 如果内容为空，显示提示
  if (!content) {
    return (
      <div className="text-gray-500 text-sm flex items-center gap-2">
        <span>暂无内容</span>
      </div>
    );
  }

  // 如果内容是空白字符，也显示提示
  if (content.trim() === '') {
    return (
      <div className="text-gray-500 text-sm">
        内容为空白字符
      </div>
    );
  }

  // 渲染内容
  return (
    <div ref={contentRef} className="prose prose-xs max-w-none break-words whitespace-pre-wrap relative">
      <style jsx global>{`
        .prose {
          font-size: 0.75rem;
          line-height: 1.3;
        }
        .prose h1 {
          font-size: 1.25rem;
          margin-top: 1.2rem;
          margin-bottom: 0.8rem;
          font-weight: 600;
        }
        .prose h2 {
          font-size: 1.125rem;
          margin-top: 1rem;
          margin-bottom: 0.6rem;
          font-weight: 600;
        }
        .prose h3 {
          font-size: 1rem;
          margin-top: 0.8rem;
          margin-bottom: 0.4rem;
          font-weight: 600;
        }
        .prose p {
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }
        .prose ul, .prose ol {
          margin-top: 0.3rem;
          margin-bottom: 0.3rem;
          padding-left: 1.5rem;
          font-size: 0.75rem;
        }
        .prose li {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
          font-size: 0.75rem;
          line-height: 1.2;
        }
        .prose li > ul, .prose li > ol {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
        }
        .prose li p {
          margin-top: 0.1rem;
          margin-bottom: 0.1rem;
        }
        .prose code {
          font-size: 0.75rem;
          padding: 0.2rem 0.4rem;
          background-color: #f3f4f6;
          border-radius: 0.25rem;
        }
        .prose pre {
          font-size: 0.75rem;
          padding: 0.75rem;
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          overflow-x: auto;
        }
        /* 表格样式 */
        .prose table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
          font-size: 0.75rem;
          overflow-x: auto;
          display: block;
        }
        .prose thead {
          background-color: #f3f4f6;
        }
        .prose thead tr {
          border-bottom: 2px solid #e5e7eb;
        }
        .prose tbody tr {
          border-bottom: 1px solid #e5e7eb;
        }
        .prose tbody tr:last-child {
          border-bottom: none;
        }
        .prose th {
          padding: 0.5rem;
          text-align: left;
          font-weight: 600;
          color: #111827;
          border: 1px solid #d1d5db;
        }
        .prose td {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          vertical-align: top;
        }
        .prose tr:nth-child(even) {
          background-color: #f9fafb;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({children}: {children: React.ReactNode}) => <h1 className="text-xl font-bold mb-2 pb-1 border-b">{children}</h1>,
          h2: ({children}: {children: React.ReactNode}) => <h2 className="text-lg font-semibold mb-2 mt-3">{children}</h2>,
          h3: ({children}: {children: React.ReactNode}) => <h3 className="text-base font-medium mb-1 mt-2">{children}</h3>,
          p: ({children}: {children: React.ReactNode}) => <p className="text-gray-600 my-1 leading-normal text-sm">{children}</p>,
          ul: ({children}: {children: React.ReactNode}) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
          ol: ({children}: {children: React.ReactNode}) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
          li: ({children}: {children: React.ReactNode}) => <li className="text-gray-600 text-sm">{children}</li>,
          blockquote: ({children}: {children: React.ReactNode}) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm">{children}</blockquote>,
          code: ({children}: {children: React.ReactNode}) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs">{children}</code>,
          pre: ({children}: {children: React.ReactNode}) => <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-xs">{children}</pre>,
          table: ({children}: {children: React.ReactNode}) => <table className="min-w-full border-collapse my-2 text-xs">{children}</table>,
          thead: ({children}: {children: React.ReactNode}) => <thead className="bg-gray-50">{children}</thead>,
          tbody: ({children}: {children: React.ReactNode}) => <tbody className="divide-y divide-gray-200">{children}</tbody>,
          tr: ({children}: {children: React.ReactNode}) => <tr className="hover:bg-gray-50">{children}</tr>,
          th: ({children}: {children: React.ReactNode}) => <th className="px-3 py-2 text-left font-medium text-gray-900 border border-gray-200">{children}</th>,
          td: ({children}: {children: React.ReactNode}) => <td className="px-3 py-2 text-gray-600 border border-gray-200">{children}</td>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}; 