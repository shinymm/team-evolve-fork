'use client'

import React from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdownComponents: Components = {
  h1: ({ node, level, children, ...props }) => <h1 className="text-xl font-bold mb-2 pb-1 border-b" {...props}>{children}</h1>,
  h2: ({ node, level, children, ...props }) => <h2 className="text-lg font-semibold mb-2 mt-3" {...props}>{children}</h2>,
  h3: ({ node, level, children, ...props }) => <h3 className="text-base font-medium mb-1 mt-2" {...props}>{children}</h3>,
  p: ({ node, children, ...props }) => <p className="text-gray-600 my-1 leading-normal text-sm" {...props}>{children}</p>,
  ul: ({ node, ordered, depth, children, ...props }) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...props}>{children}</ul>,
  ol: ({ node, ordered, depth, children, ...props }) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...props}>{children}</ol>,
  li: ({ node, ordered, checked, index, children, ...props }) => <li className="text-gray-600 text-sm" {...props}>{children}</li>,
  blockquote: ({ node, children, ...props }) => <blockquote className="border-l-4 border-gray-300 pl-3 my-1 italic text-sm" {...props}>{children}</blockquote>,
  code: ({ node, inline, children, ...props }) => <code className="bg-gray-100 rounded px-1 py-0.5 text-xs" {...props}>{children}</code>,
  pre: ({ node, children, ...props }) => <pre className="bg-gray-50 rounded-lg p-3 my-2 overflow-auto text-sm" {...props}>{children}</pre>,
  table: ({ node, children, ...props }) => <table className="min-w-full border-collapse my-4 text-sm" {...props}>{children}</table>,
  thead: ({ node, children, ...props }) => <thead className="bg-gray-50" {...props}>{children}</thead>,
  tbody: ({ node, children, ...props }) => <tbody className="divide-y divide-gray-200" {...props}>{children}</tbody>,
  tr: ({ node, isHeader, children, ...props }) => <tr {...props}>{children}</tr>,
  th: ({ node, isHeader, children, ...props }) => <th className="px-3 py-2 text-left font-medium text-gray-900 border border-gray-200" {...props}>{children}</th>,
  td: ({ node, isHeader, children, ...props }) => <td className="px-3 py-2 text-gray-600 border border-gray-200" {...props}>{children}</td>,
}

const DynamicMarkdown = ({ children, className }: { children: string, className?: string }) => {
  return (
    <div className={`prose prose-sm max-w-none ${className || ''}`}>
      <Markdown 
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {children}
      </Markdown>
    </div>
  )
}

export default DynamicMarkdown 