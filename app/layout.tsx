import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Campaign Forge — AI D&D Campaign Creator',
  description: 'Generate complete D&D campaigns with AI. Built for first-time Dungeon Masters.',
}

// Runs before paint to apply saved theme — prevents flash of wrong theme
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="noise-overlay ambient-bg min-h-screen">
        <ThemeProvider>
          <NavBar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
