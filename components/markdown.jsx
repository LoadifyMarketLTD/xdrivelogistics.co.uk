import Markdown from 'markdown-to-jsx'

export default function MarkdownComp({ children }) {
  if (!children) return null
  return <div className="markdown"><Markdown>{children}</Markdown></div>
}
