import Markdown from 'markdown-to-jsx'

/**
 * Server-renderable Markdown component.
 * - Provides a named export `Markdown` used by pages: import { Markdown } from 'components/markdown'
 * - Provides a default export for other consumers.
 */
export function MarkdownComp({ content, children, className }) {
  const body = content ?? children
  if (!body) return null
  return <div className={['markdown', className].filter(Boolean).join(' ')}><Markdown>{body}</Markdown></div>
}

// Named export required by demo pages
export const Markdown = MarkdownComp

// Default export for backwards compatibility
export default MarkdownComp
