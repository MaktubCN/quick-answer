import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '快答 - 快速回答问题',
  description: '一个简单的Web APP，用于快速回答问题',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
} 