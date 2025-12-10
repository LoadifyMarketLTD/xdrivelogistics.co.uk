// Simple Markdown-like wrapper to satisfy imports from starter pages.
// It does NOT parse markdown; it just renders children inside styled content.

export function Markdown({ children }) {
  return <div className="markdown">{children}</div>
}

export default function MarkdownComp(props) {
  return <Markdown {...props} />
}
