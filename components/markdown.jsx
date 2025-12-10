import Markdown from 'markdown-to-jsx'

/**
 * Named export used by context-alert and other components that pass content prop.
 * Accepts either `content` prop (string) or children.
 */
export function MarkdownComp({ content, children }) {
  const body = content ?? children
  if (!body) return null
  return <div className="markdown"><Markdown>{body}</Markdown></div>
}

// Keep default export for any consumers expecting default import
export default MarkdownComp
