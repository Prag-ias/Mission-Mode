import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Space_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import BottomNav from '@/components/BottomNav'
import SWRegister from '@/components/SWRegister'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
})

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
})

const satoshi = localFont({
  src: [
    { path: './fonts/Satoshi-Variable.woff2', weight: '300 900', style: 'normal' },
    { path: './fonts/Satoshi-VariableItalic.woff2', weight: '300 900', style: 'italic' },
  ],
  variable: '--font-satoshi',
})

export const metadata: Metadata = {
  title: 'Sarthi',
  description: 'UPSC CSE 2027. The app decides, you execute.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Sarthi' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fafaf7',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="work" className={`${bricolage.variable} ${spaceMono.variable} ${satoshi.variable}`}>
      <body className="bg-bg font-body text-ink antialiased">
        <div className="pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pt-14">{children}</div>
        <BottomNav />
        <SWRegister />
      </body>
    </html>
  )
}
