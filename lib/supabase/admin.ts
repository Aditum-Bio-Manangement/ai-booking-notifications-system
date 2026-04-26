import { createClient } from "@supabase/supabase-js"

// Create a Supabase admin client that bypasses RLS
// This should only be used in server-side API routes
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[SUPABASE ADMIN] Missing credentials - URL:", !!supabaseUrl, "Key:", !!supabaseServiceKey)
        return null
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
