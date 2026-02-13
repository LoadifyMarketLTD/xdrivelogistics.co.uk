import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Danny Courier LTD',
  description: 'Courier and logistics services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
