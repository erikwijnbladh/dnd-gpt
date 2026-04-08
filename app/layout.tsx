import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Campaign Forge — AI D&D Campaign Creator',
  description: 'Generate complete D&D campaigns with AI. Built for first-time Dungeon Masters.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise-overlay ambient-bg min-h-screen">
        {children}
      </body>
    </html>
  )
}
