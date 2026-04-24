import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/lib/auth-context'
import { TimezoneProvider } from '@/lib/timezone-context'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Booking Notifications Admin | Aditum Bio',
  description: 'AI-Enhanced Booking Notification Admin Dashboard for Cambridge and Oakland offices',
  generator: 'v0.app',
  icons: {
    icon: '/images/aditum-logo-stacked.png',
    apple: '/images/aditum-logo-stacked.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
              <TimezoneProvider>
                {children}
              </TimezoneProvider>
            </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
