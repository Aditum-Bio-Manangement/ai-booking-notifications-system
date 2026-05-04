import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Get the correct origin from headers or environment variable
  // Render.com and other proxies may send the original host in headers
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'https'

  // Use environment variable as primary, fall back to headers
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Log the successful SSO login
      await createAuditLog({
        action: "user.login",
        actorId: data.user.id,
        actorEmail: data.user.email || undefined,
        resourceType: "auth",
        details: {
          method: "microsoft_sso",
          provider: "azure",
        },
      })

      return NextResponse.redirect(`${siteUrl}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${siteUrl}/auth/error?error=auth_callback_error`)
}
