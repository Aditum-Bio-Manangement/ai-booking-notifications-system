import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createAuditLog } from "@/lib/audit"

export async function POST() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        let userEmail: string | undefined

        if (supabaseUrl && supabaseKey) {
            const supabase = await createClient()

            // Get user info before signing out for audit log
            const { data: { user } } = await supabase.auth.getUser()
            userEmail = user?.email

            await supabase.auth.signOut()

            // Log the logout event
            if (userEmail) {
                await createAuditLog({
                    action: "user.logout",
                    actorId: user?.id,
                    actorEmail: userEmail,
                    resourceType: "auth",
                    details: { method: "supabase" },
                })
            }
        }

        // Clear all Supabase-related cookies manually
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()

        // Create response with cookie clearing headers
        const response = NextResponse.json({ success: true })

        // Clear any cookies that might contain auth data
        for (const cookie of allCookies) {
            if (cookie.name.includes('supabase') ||
                cookie.name.includes('sb-') ||
                cookie.name.includes('auth')) {
                response.cookies.delete(cookie.name)
            }
        }

        return response
    } catch (error) {
        console.error("Logout error:", error)
        // Even if there's an error, try to clear cookies
        const response = NextResponse.json({ success: true })
        return response
    }
}
