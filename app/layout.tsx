import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '低波红利ETF - 东方财富',
  description: '基于东方财富数据的A股低波红利ETF组合系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
