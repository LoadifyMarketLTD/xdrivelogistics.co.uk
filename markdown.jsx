import dynamic from 'next/dynamic'
import React from 'react'

const ReactMarkdown = dynamic(() => import('markdown-to-jsx'), { ssr: false })

export function MarkdownComp({ children }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}

// Backwards-compatible named export "Markdown" expected by old starter pages
export const Markdown = MarkdownComp
