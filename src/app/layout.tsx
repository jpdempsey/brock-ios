import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Brock Brain API',
  description: 'Backend API for Brock iOS App',
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

