import MarkdownToJsx from 'markdown-to-jsx'

/**
 * Basic, server-renderable Markdown renderer.
 * Accepts either `content` prop or children.
 * Exports named `Markdown` and default export.
 */
export function Markdown({ content, children, className }) {
  const body = content ?? children
  if (!body) return null

  return (
    <div className={['markdown', className].filter(Boolean).join(' ')}>
      <MarkdownToJsx
        options={{
          forceWrapper: true,
        }}
      >
        {body}
      </MarkdownToJsx>
    </div>
  )
}

export default Markdown
